import {
  Controller, Get, Post, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import type { Request }          from 'express';
import { ConfigSecretsService }  from './config-secrets.service';
import { CreateSecretDto }       from './dto/create-secret.dto';
import { Tenant }                from '@real/auth-server';
import type { TenantContext }    from '@real/auth-server';
import { Roles }                 from '@real/auth-server';
import { Public }                from '@real/auth-server';
import { StepUpGuard }           from '../common/guards/step-up.guard';
import { ApiKeyGuard }           from '../common/guards/api-key.guard';
import { IsString }              from 'class-validator';

class RotateSecretDto {
  @IsString()
  value!: string;
}

/**
 * ConfigSecretsController
 *
 * TenantGuard y RolesGuard son GLOBALES (APP_GUARD en AppModule).
 * StepUpGuard se mantiene INLINE porque solo aplica a operaciones
 * criticas (rotate y revoke) — verifica re-autenticacion reciente (5 min).
 */
@Controller('config/secrets')
@Roles('OWNER')
export class ConfigSecretsController {
  constructor(private readonly svc: ConfigSecretsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Tenant() t: TenantContext,
    @Body() dto: CreateSecretDto,
    @Req() req: Request,
  ) {
    return this.svc.create(t.organizationId, t.userId, dto, req.ip);
  }

  @Get()
  list(@Tenant() t: TenantContext) {
    return this.svc.list(t.organizationId);
  }

  @Post(':id/rotate')
  @UseGuards(StepUpGuard)
  rotate(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Body() dto: RotateSecretDto,
    @Req() req: Request,
  ) {
    return this.svc.rotate(t.organizationId, t.userId, id, dto.value, req.ip);
  }

  @Delete(':id')
  @UseGuards(StepUpGuard)
  revoke(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.svc.revoke(t.organizationId, t.userId, id, req.ip);
  }

  @Public()
  @Get('resolve/:key')
  @UseGuards(ApiKeyGuard)
  resolve(@Param('key') key: string, @Req() req: Request & { tenant: TenantContext }) {
    return this.svc.resolve(req.tenant.organizationId, key);
  }
}
