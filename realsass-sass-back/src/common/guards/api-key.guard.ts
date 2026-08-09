import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService }   from '../../prisma/prisma.service';
import { MembershipRole }  from '@prisma/client';
import * as bcrypt         from 'bcryptjs';

const KEY_PREFIX = 'sk_live_';

/**
 * ApiKeyGuard — autentica via header x-api-key.
 * Usada en rutas de sistema que consumen config en runtime:
 *   GET /config/secrets/resolve/:key
 *   GET /config/flags/:orgId
 *   GET /config/templates/:key
 *
 * NO es un APP_GUARD global — se aplica inline con @UseGuards(ApiKeyGuard)
 * solo en las rutas que lo necesitan.
 *
 * Inyecta req.tenant con el organizationId de la API Key para que
 * los services puedan usarlo normalmente.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req    = ctx.switchToHttp().getRequest();
    const rawKey = req.headers['x-api-key'] as string | undefined;

    if (!rawKey) return false;
    if (!rawKey.startsWith(KEY_PREFIX)) {
      throw new UnauthorizedException('Formato de API Key invalido');
    }

    const keyPrefix  = rawKey.substring(0, 12);
    const candidates = await this.prisma.apiKey.findMany({
      where: {
        keyPrefix,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { organization: true },
    });

    for (const candidate of candidates) {
      const valid = await bcrypt.compare(rawKey, candidate.keyHash);
      if (valid) {
        // Actualizar lastUsedAt sin bloquear el request
        void this.prisma.apiKey
          .update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } })
          .catch(() => null);

        req.tenant = {
          organizationId:     candidate.organizationId,
          role:               MembershipRole.MEMBER,
          apiKeyScopes:       candidate.scopes as string[],
          productPermissions: {},
        };
        return true;
      }
    }

    throw new UnauthorizedException('API Key invalida o expirada');
  }
}
