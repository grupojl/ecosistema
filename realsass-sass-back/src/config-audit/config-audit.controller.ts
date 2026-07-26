import {
  Controller, Get, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ConfigAuditService } from './config-audit.service';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/guards/tenant.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('config/audit')
@UseGuards(TenantGuard, RolesGuard)
@Roles('OWNER')
export class ConfigAuditController {
  constructor(private readonly svc: ConfigAuditService) {}

  @Get()
  list(
    @Tenant() t: TenantContext,
    @Query('configType') configType?: string,
    @Query('userId')     userId?: string,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take?: number,
    @Query('skip', new DefaultValuePipe(0),  ParseIntPipe) skip?: number,
  ) {
    return this.svc.getByOrg(t.organizationId, { configType, userId }, take, skip);
  }
}
