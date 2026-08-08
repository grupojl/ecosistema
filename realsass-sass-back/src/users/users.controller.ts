import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Patch } from '@nestjs/common';
import { UsersService }                                from './users.service';
import { CurrentUser, type CurrentUserPayload }        from '@real/auth-server';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.users.getMyProfile(user.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado.');
    return { success: true, data: profile };
  }

  @Patch('me/role')
  @HttpCode(HttpStatus.OK)
  async selectRole(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { role: 'owner' | 'affiliate' },
  ) {
    return this.users.selectRole(user.uid, body);
  }
}
