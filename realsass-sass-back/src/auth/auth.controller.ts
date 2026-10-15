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
  Controller, Get, Body, Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser }          from '@real/auth-server';
import type { CurrentUserPayload } from '@real/auth-server';
import { UsersService }           from '@/users/users.service';
import { AuthService }            from '@/auth/auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:  AuthService,
    private readonly usersService: UsersService,
  ) {}

  // POST /auth/firebase-sso se eliminó: era un stub que solo hacía res.redirect() y el front nunca lo
  // pudo usar (esperaba un JSON con customToken). Ahora es el procedure tRPC auth.createDashboardSso.

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

// ─── INTEGRACIÓN SUPERADMIN — ADR-013 ─────────────────────────────────────────
// findBySlugPublic devuelve la entidad Organization con storeStatus.
// Quien construya la respuesta HTTP/tRPC con ecommerceEnabled debe usar:
//   ecommerceEnabled: org.storeStatus === 'ACTIVE'
// StoreService en realsass-ecommerce-back ya maneja ecommerceEnabled: false con NotFoundException.
// ──────────────────────────────────────────────────────────────────────────────
