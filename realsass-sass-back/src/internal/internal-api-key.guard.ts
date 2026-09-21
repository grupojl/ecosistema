// realsass-sass-back/src/internal/internal-api-key.guard.ts
//
// Guard para endpoints /internal/* consumidos por grupojl-control (superadmin).
// Valida el header x-internal-api-key contra INTERNAL_API_KEY de ConfigService.
// No usa Firebase ni tRPC — es un guard HTTP puro independiente.
//
// Sin header              → 401
// Header incorrecto       → 401
// Header correcto         → pasa al controller
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req  = ctx.switchToHttp().getRequest<Request>();
    const key  = req.headers['x-internal-api-key'] as string | undefined;
    const expected = this.config.getOrThrow<string>('INTERNAL_API_KEY');

    if (!key || key !== expected) {
      this.logger.warn(
        `[InternalApiKeyGuard] Unauthorized attempt from ${req.ip} — key mismatch`,
      );
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}
