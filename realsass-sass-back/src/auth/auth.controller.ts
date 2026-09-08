/**
 * auth.controller.ts — realsass-sass-back
 *
 * Endpoints REST de auth — los que NO pueden ir por tRPC:
 *   POST   /auth/session           → crea cookie HttpOnly (ADR-004)
 *   DELETE /auth/session           → revoca cookie HttpOnly (ADR-004)
 *   GET    /auth/firebase-sso      → redirect SSO entre fronts
 *   GET    /auth/organization-access → consumido por ecommerce-back vía HTTP
 *
 * ADR-012: Rate limiting 10 req/min por IP en endpoints de sesión.
 */
import {
  Controller, Post, Delete, Get,
  Req, Res, HttpCode, HttpStatus,
  Param, UnauthorizedException,
} from '@nestjs/common';
import { Throttle }      from '@nestjs/throttler';
import { ApiTags }       from '@nestjs/swagger';
import { Public }        from '@real/auth-server';
import { AuthService }   from './auth.service';
import { UsersService }  from '../users/users.service';
import type { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:  AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * POST /auth/session
   * Recibe ID token de Firebase → emite cookie HttpOnly __session.
   * Rate limiting: 10 req/min por IP (ADR-012 — previene brute force).
   */
  @Public()
  @Post('session')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createSession(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    const idToken = (req.body as Record<string, unknown>)['idToken'] as string | undefined;
    if (!idToken?.trim()) {
      return res.status(400).json({ message: 'idToken requerido' });
    }

    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const { sessionCookie } = await this.authService.createSessionCookie(idToken, FOURTEEN_DAYS_MS);

    res.cookie('__session', sessionCookie, {
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
      maxAge:   FOURTEEN_DAYS_MS,
      path:     '/',
    });
    return res.json({ ok: true });
  }

  /**
   * DELETE /auth/session
   * Revoca cookie HttpOnly + sesión Firebase.
   * Rate limiting: 10 req/min por IP (ADR-012).
   */
  @Public()
  @Delete('session')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async deleteSession(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    const sessionCookie = (req.cookies as Record<string, string>)['__session'];
    if (sessionCookie) {
      await this.authService.revokeSession(sessionCookie).catch(() => {});
    }
    res.clearCookie('__session', { path: '/' });
    return res.json({ ok: true });
  }

  /** GET /auth/firebase-sso — SSO entre sass-front y dashboard-front */
  @Get('firebase-sso')
  async firebaseSso(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    const sessionCookie = (req.cookies as Record<string, string>)['__session'];
    if (!sessionCookie) throw new UnauthorizedException('No autenticado');
    const customToken  = await this.authService.generateCustomToken(sessionCookie);
    const dashboardUrl = process.env['DASHBOARD_FRONT_URL'] ?? '';
    return res.redirect(`${dashboardUrl}/auth/sso?token=${customToken}`);
  }

  /** GET /auth/organization-access/:id — consumido por ecommerce-back vía HTTP */
  @Get('organization-access/:organizationId')
  async getOrganizationAccess(
    @Param('organizationId') organizationId: string,
    @Req() req: Request,
  ) {
    const sessionCookie = (req.cookies as Record<string, string>)['__session'];
    if (!sessionCookie) return { hasAccess: false };
    try {
      const decoded = await this.authService.verifySession(sessionCookie);
      return await this.usersService.getOrganizationAccess(decoded.uid, organizationId);
    } catch {
      return { hasAccess: false };
    }
  }
}
