import {
  CanActivate, ExecutionContext, Injectable,
  Logger, UnauthorizedException,
} from '@nestjs/common';
import { Reflector }     from '@nestjs/core';
import { getAuth }       from 'firebase-admin/auth';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { SESSION_COOKIE_NAME } from '@/session/session.service';
import type { CurrentUserPayload, TenantContext } from '@/types/tenant-context';
import { bearerOf, cookieOf, errorMessage, type CookieSource, type HeaderSource } from '@/http/request';

interface AuthRequest extends HeaderSource, CookieSource {
  user?: CurrentUserPayload;
  tenant?: TenantContext;
}

/** Un claim de Firebase solo vale si es texto. */
const textClaim = (value: unknown): string | null => (typeof value === 'string' ? value : null);

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

    const req   = ctx.switchToHttp().getRequest<AuthRequest>();
    const token = bearerOf(req);
    // ADR-004: sin Bearer, la sesión viaja en la cookie HttpOnly __session.
    const sessionCookie = token ? undefined : cookieOf(req, SESSION_COOKIE_NAME);

    if (!token && !sessionCookie) {
      throw new UnauthorizedException('Token de autenticacion requerido');
    }

    try {
      const decoded = token
        ? await getAuth().verifyIdToken(token)
        : await getAuth().verifySessionCookie(sessionCookie ?? '', true);

      req.user = {
        uid:         decoded.uid,
        email:       decoded.email ?? '',
        displayName: textClaim(decoded['name']),
        avatarUrl:   textClaim(decoded['picture']),
      } satisfies CurrentUserPayload;

      return true;
    } catch (error) {
      this.logger.warn(`Token invalido: ${errorMessage(error)}`);
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }

}
