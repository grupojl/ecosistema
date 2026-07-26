import {
  Controller, Post, Get, HttpCode, HttpStatus, Query, NotFoundException,
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
   * Devuelve el perfil completo (shape canónico).
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
   * Alias de GET /users/me — útil para SSO con otros sistemas del ecosistema.
   */
  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.usersService.getMyProfile(user.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llamá a /auth/sync primero.');
    return { success: true, data: profile };
  }

  /**
   * GET /auth/dashboard-access
   * Protegido por FirebaseAuthGuard.
   * El dashboard-back lo consulta para saber el rol real del usuario
   * antes de asignarle ADMIN o AGENTE en su propia DB.
   */
  @Get('dashboard-access')
  async dashboardAccess(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getDashboardAccess(user.uid);
  }
}
