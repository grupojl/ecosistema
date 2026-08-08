import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ConfigWebhooksService } from './config-webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { Tenant } from '@real/auth-server';
import type { TenantContext } from '@real/auth-server';
import { Roles } from '@real/auth-server';
import { TenantGuard } from '@real/auth-server';
import { RolesGuard } from '@real/auth-server';

@Controller('config/webhooks')
@UseGuards(TenantGuard, RolesGuard)
@Roles('OWNER')
export class ConfigWebhooksController {
  constructor(private readonly svc: ConfigWebhooksService) {}

  @Get()
  list(@Tenant() t: TenantContext) { return this.svc.list(t.organizationId); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Tenant() t: TenantContext, @Body() dto: CreateWebhookDto) { return this.svc.create(t.organizationId, t.userId, dto); }

  @Post(':id/test')
  test(@Tenant() t: TenantContext, @Param('id') id: string) { return this.svc.test(t.organizationId, id); }

  @Delete(':id')
  remove(@Tenant() t: TenantContext, @Param('id') id: string) { return this.svc.remove(t.organizationId, t.userId, id); }

  @Get(':id/logs')
  getLogs(@Tenant() t: TenantContext, @Param('id') id: string, @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number) {
    return this.svc.getLogs(t.organizationId, id, take);
  }
}
