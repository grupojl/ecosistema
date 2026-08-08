import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigThemesService } from './config-themes.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';
import { Roles } from '@real/auth-server';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';

@Controller('config/themes')
@UseGuards(TenantGuard, RolesGuard)
export class ConfigThemesController {
  constructor(private readonly svc: ConfigThemesService) {}

  @Get()
  @Roles('OWNER', 'MEMBER')
  list(@Tenant() t: TenantContext) {
    return this.svc.list(t.organizationId);
  }

  @Post()
  @Roles('OWNER')
  @HttpCode(HttpStatus.CREATED)
  create(@Tenant() t: TenantContext, @Body() dto: CreateThemeDto) {
    return this.svc.create(t.organizationId, t.userId, dto);
  }

  @Post(':id/activate')
  @Roles('OWNER')
  activate(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.activate(t.organizationId, t.userId, id);
  }

  @Delete(':id')
  @Roles('OWNER')
  remove(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.remove(t.organizationId, t.userId, id);
  }
}
