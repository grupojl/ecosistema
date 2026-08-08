import {
  Body, Controller, Get, Headers,
  HttpCode, HttpStatus, NotFoundException, Post, Query,
} from '@nestjs/common';
import { AuthService }                           from './auth.service';
import { UsersService }                          from '../users/users.service';
import { Public, CurrentUser, type CurrentUserPayload } from '@real/auth-server';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth:  AuthService,
    private readonly users: UsersService,
  ) {}

  /** POST /api/v1/auth/sync — crea o actualiza el usuario. Idempotente. */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(
    @CurrentUser() user: CurrentUserPayload,
    @Query('ref') affiliateCode?: string,
  ) {
    const result = await this.auth.syncUser(user, affiliateCode);
    return {
      success: true,
      isNew:   result.isNew,
      message: result.isNew ? 'Usuario creado' : 'Usuario sincronizado',
      data:    result.user,
    };
  }

  /** GET /api/v1/auth/me — perfil completo. */
  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.users.getMyProfile(user.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llama a /auth/sync primero.');
    return { success: true, data: profile };
  }

  /** GET /api/v1/auth/organization-access — contrato con ecommerce-back. */
  @Get('organization-access')
  async organizationAccess(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') organizationId: string,
  ) {
    if (!organizationId) return { canAccess: false, reason: 'Header x-organization-id requerido' };
    return this.users.getOrganizationAccess(user.uid, organizationId);
  }

  /** POST /api/v1/auth/firebase-sso — SSO publico entre fronts. */
  @Public()
  @Post('firebase-sso')
  @HttpCode(HttpStatus.OK)
  async firebaseSso(@Body() body: { firebaseIdToken?: string }) {
    if (!body?.firebaseIdToken) throw new NotFoundException('firebaseIdToken requerido');
    const result = await this.auth.generateCustomToken(body.firebaseIdToken);
    return { success: true, ...result };
  }
}
