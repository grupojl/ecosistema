/**
 * auth-session-throttled.controller.ts — realsass-sass-back
 *
 * Override de AuthSessionController con rate limiting estricto.
 *
 * El AuthSessionController base está en @real/auth-server (package compartido)
 * y no puede tener @Throttle() sin afectar ecommerce-back.
 * Este controller re-expone POST /auth/session con el throttle de 10 req/min
 * sobreescribiendo el comportamiento global de 30 req/min.
 *
 * IMPORTANTE: registrar este controller EN LUGAR DE AuthSessionController
 * en auth.module.ts:
 *   controllers: [AuthController, AuthSessionThrottledController]
 *   (sin AuthSessionController)
 *
 * E7-06 — Fase 3 Hardening
 */
import {
  Controller,
  Post,
  Delete,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Throttle }                                    from '@nestjs/throttler';
import type { Response }                               from 'express';
import { SessionService, SESSION_COOKIE_NAME }         from '@real/auth-server';
import { Public, CurrentUser }                         from '@real/auth-server';
import type { CurrentUserPayload }                     from '@real/auth-server';
import { SecurityLogger }                              from '@/common/logger/security-logger';

@Controller('auth')
export class AuthSessionThrottledController {
  private readonly logger = new Logger(AuthSessionThrottledController.name);

  constructor(private readonly sessionService: SessionService) {}

  /**
   * POST /auth/session
   * Rate limit: 10 req/min por IP (named throttler 'auth').
   * El throttle global es 30/min — este override lo restringe para el endpoint de auth.
   */
  @Post('session')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  async createSession(
    @Body('idToken') idToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean }> {
    if (!idToken) {
      SecurityLogger.authFailure(this.logger, {
        reason: 'idToken missing in POST /auth/session',
      });
      throw new UnauthorizedException('idToken requerido');
    }

    const sessionCookie = await this.sessionService.createSessionCookie(idToken);

    res.cookie(
      SESSION_COOKIE_NAME,
      sessionCookie,
      this.sessionService.getCookieOptions(),
    );

    return { ok: true };
  }

  /**
   * DELETE /auth/session
   * Sin throttle estricto — el usuario ya está autenticado para llegar acá.
   */
  @Delete('session')
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean }> {
    await this.sessionService.revokeSession(user.uid);

    SecurityLogger.sessionRevoked(this.logger, {
      uid:    user.uid,
      reason: 'logout',
    });

    res.cookie(
      SESSION_COOKIE_NAME,
      '',
      this.sessionService.getClearCookieOptions(),
    );

    return { ok: true };
  }
}
