import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigThemesService } from './config-themes.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('config/themes')
@UseGuards(TenantGuard, RolesGuard)
export class ConfigThemesController {
  constructor(private readonly svc: ConfigThemesService) {}

  @Get()
  @Roles('OWNER', 'COLLABORATOR')
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
