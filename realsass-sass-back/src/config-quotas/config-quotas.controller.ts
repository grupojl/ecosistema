import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ConfigQuotasService } from './config-quotas.service';
import { IsInt, Min } from 'class-validator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';

class UpdateLimitDto {
  @IsInt() @Min(-1)
  limit: number;
}

@Controller('config/quotas')
@UseGuards(TenantGuard, RolesGuard)
export class ConfigQuotasController {
  constructor(private readonly svc: ConfigQuotasService) {}

  @Get()
  @Roles('OWNER')
  list(@Tenant() t: TenantContext) {
    return this.svc.getForOrg(t.organizationId);
  }

  @Patch(':resource')
  @Roles('OWNER')
  updateLimit(@Tenant() t: TenantContext, @Param('resource') resource: string, @Body() dto: UpdateLimitDto) {
    return this.svc.updateLimit(t.organizationId, t.userId, resource, dto.limit);
  }
}
