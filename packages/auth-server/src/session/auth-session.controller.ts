/**
 * auth-session.controller.ts — @real/auth-server
 *
 * Controller reutilizable para gestión de session cookies HttpOnly.
 * Cada back lo registra en su AuthModule o SessionModule.
 *
 * Endpoints:
 *   POST   /auth/session  → crea Firebase Session Cookie HttpOnly
 *   DELETE /auth/session  → revoca tokens y limpia cookie
 *
 * Por qué es un controller compartido y no uno por back:
 *   La lógica es idéntica en todos los backs que usen Firebase auth.
 *   Duplicar sería violar Capa 1 — ver ADR-004.
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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionService, SESSION_COOKIE_NAME } from './session.service';
import { Public }                              from '../decorators/public.decorator';
import { CurrentUser }                         from '../decorators/current-user.decorator';
import type { CurrentUserPayload }             from '../types/tenant-context';

@Controller('auth')
export class AuthSessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * POST /auth/session
   *
   * Recibe el ID token de Firebase del front, verifica que sea válido,
   * crea una Firebase Session Cookie y la setea como cookie HttpOnly.
   *
   * El front llama esto inmediatamente después del login Firebase.
   * Después de este endpoint, el front NO necesita enviar Bearer token —
   * la cookie viaja automáticamente con credentials: 'include'.
   */
  @Post('session')
  @Public()
  @HttpCode(HttpStatus.OK)
  async createSession(
    @Body('idToken') idToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean }> {
    if (!idToken) {
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
   *
   * Revoca los refresh tokens del usuario en Firebase (invalida la session
   * cookie en todos los dispositivos) y limpia la cookie del browser.
   *
   * Requiere que el usuario esté autenticado — usa CurrentUser del guard global.
   */
  @Delete('session')
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean }> {
    await this.sessionService.revokeSession(user.uid);

    res.cookie(
      SESSION_COOKIE_NAME,
      '',
      this.sessionService.getClearCookieOptions(),
    );

    return { ok: true };
  }
}
