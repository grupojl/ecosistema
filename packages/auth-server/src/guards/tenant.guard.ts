import {
  CanActivate, ExecutionContext, ForbiddenException,
  Inject, Injectable, Logger, UnauthorizedException,
} from '@nestjs/common';
import { CACHE_PORT }    from '../ports/cache.port';
import type { CachePort } from '../ports/cache.port';
import type { TenantContext, CurrentUserPayload, OrganizationAccessResult } from '../types/tenant-context';

const CACHE_TTL = 90; // segundos — evita hop de red por cada request

/**
 * TenantGuard — resuelve TenantContext para ecommerce-back.
 * Llama a sass-back GET /api/v1/auth/organization-access con cache.
 *
 * En sass-back no uses este guard — el TenantContext se resuelve
 * directamente desde Prisma sin hop de red.
 *
 * Variable de entorno requerida en ecommerce-back:
 *   SASS_BACK_URL=https://tu-sass-back.railway.app
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req            = ctx.switchToHttp().getRequest();
    const user           = req.user as CurrentUserPayload | undefined;
    const organizationId = req.headers['x-organization-id'] as string | undefined;
    const token          = this.extractToken(req);

    if (!organizationId) throw new ForbiddenException('Header x-organization-id requerido');
    if (!user?.uid)      throw new UnauthorizedException('Usuario no autenticado');
    if (!token)          throw new UnauthorizedException('Bearer token requerido');

    const cacheKey = `org-access:${user.uid}:${organizationId}`;

    const cached = await this.cache.get<TenantContext>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      req.tenant = cached;
      return true;
    }

    const sassBackUrl = process.env['SASS_BACK_URL'];
    if (!sassBackUrl) {
      throw new ForbiddenException('Variable de entorno SASS_BACK_URL no configurada');
    }

    let result: OrganizationAccessResult;
    try {
      const res = await fetch(`${sassBackUrl}/api/v1/auth/organization-access`, {
        headers: {
          'Authorization':     `Bearer ${token}`,
          'x-organization-id': organizationId,
        },
      });
      if (!res.ok) throw new ForbiddenException('Sin acceso a esta organizacion');
      result = await res.json() as OrganizationAccessResult;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Error en organization-access: ${(error as Error).message}`);
      throw new ForbiddenException('Error al verificar permisos');
    }

    if (!result.canAccess || !result.role || !result.userId) {
      throw new ForbiddenException(result.reason ?? 'Sin acceso a esta organizacion');
    }

    const tenantCtx: TenantContext = {
      userId:         result.userId,
      organizationId: result.organizationId ?? organizationId,
      role:           result.role,
      permissions:    result.permissions ?? {},
    };

    await this.cache.set(cacheKey, tenantCtx, CACHE_TTL);
    req.tenant = tenantCtx;
    return true;
  }

  private extractToken(req: { headers: Record<string, string | undefined> }): string | undefined {
    const [type, token] = req.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
