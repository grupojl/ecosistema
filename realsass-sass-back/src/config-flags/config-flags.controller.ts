import { Controller, Get, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ConfigFlagsService } from './config-flags.service';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';
import { Roles } from '@real/auth-server';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';

@Controller('config/flags')
@UseGuards(TenantGuard, RolesGuard)
export class ConfigFlagsController {
  constructor(private readonly svc: ConfigFlagsService) {}

  @Get()
  @Roles('OWNER', 'COLLABORATOR')
  list(@Tenant() tenant: TenantContext, @Query('role') role?: string, @Query('plan') plan?: string) {
    return this.svc.getForOrg(tenant.organizationId, role, plan);
  }

  @Patch(':id')
  @Roles('OWNER')
  update(@Tenant() tenant: TenantContext, @Param('id') id: string, @Body() dto: UpdateFlagDto) {
    return this.svc.update(tenant.organizationId, tenant.userId, id, dto);
  }
}
