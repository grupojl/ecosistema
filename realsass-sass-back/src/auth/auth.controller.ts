import { Public } from '../common/guards/firebase-auth.guard';
import {
  Controller, Post, Get, HttpCode, HttpStatus, Query, NotFoundException, Headers, Body,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * POST /auth/sync
   * Sincroniza el usuario de Firebase con la DB.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncUser(
    @CurrentUser() user: CurrentUserPayload,
    @Query('ref') affiliateCode?: string,
  ) {
    const result = await this.authService.syncUser(user, affiliateCode);
    return {
      success: true,
      isNew:   result.isNew,
      message: result.isNew ? 'Usuario creado exitosamente' : 'Usuario sincronizado exitosamente',
      data:    result.user,
    };
  }

  /**
   * GET /auth/me
   * Perfil completo del usuario autenticado.
   */
  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.usersService.getMyProfile(user.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llamá a /auth/sync primero.');
    return { success: true, data: profile };
  }

  /**
   * GET /auth/dashboard-access
   * Usado por real-dashboard-back para resolver rol del usuario.
   */
  @Get('dashboard-access')
  async dashboardAccess(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getDashboardAccess(user.uid);
  }

  /**
   * GET /auth/organization-access
   *
   * Contrato con sistemas hoja del ecosistema (real-config-back, etc.).
   * Recibe el usuario autenticado (via FirebaseAuthGuard) y el organizationId
   * en el header x-organization-id, y responde si ese usuario tiene acceso
   * a esa organización y con qué rol/permisos.
   *
   * Shape de respuesta:
   * {
   *   canAccess: boolean,
   *   userId?: string,
   *   organizationId?: string,
   *   role?: 'OWNER' | 'COLLABORATOR',
   *   permissions?: CollaboratorPermissions,
   *   reason?: string,
   * }
   */
  @Get('organization-access')
  async organizationAccess(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') organizationId: string,
  ) {
    if (!organizationId) {
      return { canAccess: false, reason: 'x-organization-id header requerido' };
    }
    return this.usersService.getOrganizationAccess(user.uid, organizationId);
  }

  /**
   * POST /auth/firebase-sso
   *
   * Endpoint público — no requiere cookie ni sesión previa.
   * Recibe el Firebase idToken del sass-front, lo verifica, y devuelve
   * un customToken para que el dashboard-front haga signInWithCustomToken.
   *
   * Caller: hooks/use-dashboard-sso.ts (realsass-sass-front)
   * Consumer: app/auth/sso/page.tsx (realsass-dashboard-front)
   */
  @Public()
  @Post('firebase-sso')
  @HttpCode(HttpStatus.OK)
  async firebaseSso(@Body() body: { firebaseIdToken: string }) {
    if (!body?.firebaseIdToken) {
      throw new NotFoundException('firebaseIdToken requerido en el body');
    }
    const result = await this.authService.generateCustomToken(body.firebaseIdToken);
    return {
      success:     true,
      customToken: result.customToken,
      uid:         result.uid,
      email:       result.email,
    };
  }
}
