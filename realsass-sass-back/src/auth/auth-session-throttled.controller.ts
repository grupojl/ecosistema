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
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Throttle }                                    from '@nestjs/throttler';
import type { Request, Response }                        from 'express';
import { SessionService, SESSION_COOKIE_NAME, SESSION_ID_COOKIE_NAME } from '@real/auth-server';
import { Public, CurrentUser }                         from '@real/auth-server';
import type { CurrentUserPayload }                     from '@real/auth-server';
import { SecurityLogger }                              from '@/common/logger/security-logger';
import { SessionsService }                             from '@/sessions/sessions.service';

@Controller('auth')
export class AuthSessionThrottledController {
  private readonly logger = new Logger(AuthSessionThrottledController.name);

  constructor(
    private readonly sessionService:  SessionService,
    private readonly sessionsService: SessionsService,
  ) {}

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
    @Req() req: Request,
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

    await this.registerDevice(sessionCookie, req, res);

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
    // Firebase revoca los refresh tokens de todos los dispositivos: las filas quedan igual.
    await this.sessionsService.revokeAll(user.uid).catch((err) =>
      this.logger.warn(`revokeAll falló: ${String(err)}`));

    SecurityLogger.sessionRevoked(this.logger, {
      uid:    user.uid,
      reason: 'logout',
    });

    res.cookie(
      SESSION_COOKIE_NAME,
      '',
      this.sessionService.getClearCookieOptions(),
    );
    res.cookie(SESSION_ID_COOKIE_NAME, '', this.sessionService.getClearCookieOptions());

    return { ok: true };
  }

  /**
   * ADR-020: registra o renueva la sesión del dispositivo y emite `__sid`.
   * Es best-effort: si falla, el login igual funciona (la sesión no aparece en la lista).
   */
  private async registerDevice(sessionCookie: string, req: Request, res: Response): Promise<void> {
    try {
      const { uid } = await this.sessionService.verifySessionCookie(sessionCookie);
      const current  = (req.cookies as Record<string, string | undefined> | undefined)?.[SESSION_ID_COOKIE_NAME];
      const sid      = await this.sessionsService.register(uid, {
        userAgent:     req.headers['user-agent'],
        ip:            req.ip,
        countryHeader: req.headers['cf-ipcountry'] as string | undefined,
      }, current);
      if (sid) res.cookie(SESSION_ID_COOKIE_NAME, sid, this.sessionService.getCookieOptions());
    } catch (err) {
      this.logger.warn(`No se pudo registrar la sesión del dispositivo: ${String(err)}`);
    }
  }
}
