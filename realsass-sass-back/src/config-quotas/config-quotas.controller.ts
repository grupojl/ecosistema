import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ConfigQuotasService } from './config-quotas.service';
import { IsInt, Min } from 'class-validator';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';
import { Roles } from '@real/auth-server';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';

class UpdateLimitDto {
  @IsInt() @Min(-1)
  limit!: number;
}

@Controller('config/quotas')

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
