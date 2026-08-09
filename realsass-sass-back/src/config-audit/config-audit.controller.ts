import {
  Controller, Get, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ConfigAuditService } from './config-audit.service';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';
import { Roles } from '@real/auth-server';

@Controller('config/audit')

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
