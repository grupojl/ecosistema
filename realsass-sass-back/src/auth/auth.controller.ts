/**
 * auth.controller.ts — realsass-sass-back
 *
 * REST endpoints que DEBEN quedar en REST (ADR-005):
 *
 *   POST /auth/firebase-sso
 *     Redirect entre fronts tras autenticación Firebase — usa res.redirect().
 *     No puede ser tRPC porque tRPC no soporta redirects HTTP.
 *
 *   GET /auth/organization-access
 *     Consumido por realsass-ecommerce-back vía HTTP (back-to-back).
 *     No es un front — no puede usar el cliente tRPC de React.
 *
 * TODO cuando existan chat-ia-back y pagos-back:
 *   Evaluar si organization-access debe moverse a @real/auth-server
 *   como endpoint compartido en lugar de vivir en sass-back.
 */
import {
  Controller, Post, Get, Body, Query, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public, CurrentUser }   from '@real/auth-server';
import type { CurrentUserPayload } from '@real/auth-server';
import { UsersService }           from '../users/users.service';
import { AuthService }            from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:  AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * POST /api/v1/auth/firebase-sso
   * Redirect entre sass-front y dashboard-front tras auth Firebase.
   * Mantiene en REST porque necesita res.redirect() — tRPC no lo soporta.
   */
  @Post('firebase-sso')
  @Public()
  @HttpCode(HttpStatus.OK)
  async firebaseSso(
    @Body() body: { idToken: string; redirectTo?: string },
    @Res() res: Response,
  ) {
    const redirectUrl = body.redirectTo ?? process.env.DASHBOARD_FRONT_URL ?? '/';
    return res.redirect(redirectUrl);
  }

  /**
   * GET /api/v1/auth/organization-access
   * Consumido por realsass-ecommerce-back vía HTTP para resolver acceso.
   * Mantiene en REST porque es back-to-back, no front-to-back.
   */
  @Get('organization-access')
  async getOrganizationAccess(
    @CurrentUser() user: CurrentUserPayload,
    @Query('organizationId') organizationId: string,
  ) {
    return this.usersService.getOrganizationAccess(user.uid, organizationId);
  }
}
