import {
  CanActivate, ExecutionContext, Injectable,
  Logger, UnauthorizedException,
} from '@nestjs/common';
import { Reflector }     from '@nestjs/core';
import * as admin        from 'firebase-admin';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { CurrentUserPayload } from '../types/tenant-context';

/**
 * FirebaseAuthGuard — guard global de autenticacion.
 * Registrar como APP_GUARD en AppModule.
 *
 * 1. Si la ruta tiene @Public() pasa sin verificar.
 * 2. Extrae Bearer token del header Authorization.
 * 3. Verifica con Firebase Admin.
 * 4. Inyecta req.user con CurrentUserPayload.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req   = ctx.switchToHttp().getRequest();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('Token de autenticacion requerido');
    }

    try {
      const decoded = await admin.app().auth().verifyIdToken(token);

      req.user = {
        uid:         decoded.uid,
        email:       decoded.email ?? '',
        displayName: (decoded['name'] as string | undefined) ?? null,
        avatarUrl:   (decoded['picture'] as string | undefined) ?? null,
      } satisfies CurrentUserPayload;

      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`Token invalido: ${msg}`);
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }

  private extractToken(req: { headers: Record<string, string | undefined> }): string | undefined {
    const [type, token] = req.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
