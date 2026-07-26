import {
  Controller, Patch, Body, Get, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { SelectRoleDto } from './dto/select-role.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/me
   * Perfil completo: user + org + tenants (colaboraciones) + affiliateData
   */
  @Get('me')
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.usersService.getMyProfile(user.uid);
    return { success: true, data: profile };
  }

  /**
   * PATCH /users/select-role
   * Activa rol owner o affiliate. Devuelve perfil completo actualizado.
   */
  @Patch('select-role')
  @HttpCode(HttpStatus.OK)
  async selectRole(
    @CurrentUser('uid') uid: string,
    @Body() selectRoleDto: SelectRoleDto,
  ) {
    return this.usersService.selectRole(uid, selectRoleDto);
  }
}
