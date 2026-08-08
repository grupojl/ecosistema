import { Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigTemplatesService } from './config-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';
import { Roles } from '@real/auth-server';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';

@Controller('config/templates')
@UseGuards(TenantGuard, RolesGuard)
export class ConfigTemplatesController {
  constructor(private readonly svc: ConfigTemplatesService) {}

  @Get()
  @Roles('OWNER', 'MEMBER')
  list(@Tenant() t: TenantContext) {
    return this.svc.list(t.organizationId);
  }

  @Post()
  @Roles('OWNER')
  @HttpCode(HttpStatus.CREATED)
  create(@Tenant() t: TenantContext, @Body() dto: CreateTemplateDto) {
    return this.svc.create(t.organizationId, t.userId, dto);
  }

  @Get(':key/render')
  @Roles('OWNER', 'MEMBER')
  render(@Tenant() t: TenantContext, @Param('key') key: string, @Query() vars: Record<string, string>) {
    return this.svc.renderByKey(t.organizationId, key, vars);
  }
}
