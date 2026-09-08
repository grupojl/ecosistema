// realsass-sass-back/src/common/guards/internal-api-key.guard.ts
// ADR-010 — guard para endpoints /internal/*.
// Diferente del api-key.guard.ts existente (ese verifica keys de tenants).
// Este verifica la clave compartida con el superadmin de GrupoJL.
import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Verifica el header x-internal-api-key contra la env var INTERNAL_API_KEY.
 * Fail-secure: si INTERNAL_API_KEY no está configurada → rechaza todo.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly key: string | undefined;

  constructor() {
    this.key = process.env['INTERNAL_API_KEY'];
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req    = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers['x-internal-api-key'] as string | undefined;

    if (!this.key) {
      throw new UnauthorizedException('INTERNAL_API_KEY no configurada en este servicio');
    }
    if (!header || header !== this.key) {
      throw new UnauthorizedException('Clave interna inválida');
    }
    return true;
  }
}
