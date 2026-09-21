// realsass-sass-back/src/internal/internal-organizations.controller.ts
//
// Endpoints REST consumidos exclusivamente por grupojl-control (superadmin).
// Protegidos por InternalApiKeyGuard — NO usan Firebase ni tRPC.
//
// Dos dimensiones de control (norte Shopify Partners):
//
//   Panel administrativo:
//     POST /internal/organizations/:id/suspend    → panel 403 (TenantGuard)
//     POST /internal/organizations/:id/unsuspend  → panel activo
//
//   Storefront público:
//     POST /internal/organizations/:id/pause-store  → 404 en storefront
//     POST /internal/organizations/:id/resume-store → storefront activo
//
// El AdminAction lo crea superadmin en su propia DB, no este controller.
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { InternalApiKeyGuard }              from './internal-api-key.guard';
import { InternalOrganizationsService }     from './internal-organizations.service';
import {
  InternalListOrgsSchema,
  InternalOrgActionSchema,
  type InternalListOrgsDto,
  type InternalOrgActionDto,
} from './schemas';
import { ZodValidationPipe } from '@real/auth-server';

@ApiTags('internal')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('internal/organizations')
export class InternalOrganizationsController {
  constructor(private readonly svc: InternalOrganizationsService) {}

  // ── Lectura ───────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lista orgs para superadmin — paginada con filtros' })
  findAll(
    @Query(new ZodValidationPipe(InternalListOrgsSchema)) dto: InternalListOrgsDto,
  ) {
    return this.svc.findAll(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una org para superadmin' })
  findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  // ── Panel administrativo ──────────────────────────────────────────────────

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspende acceso al panel — reason >= 10 chars' })
  suspend(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InternalOrgActionSchema)) dto: InternalOrgActionDto,
  ) {
    return this.svc.suspend(id, dto.reason);
  }

  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactiva acceso al panel' })
  unsuspend(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InternalOrgActionSchema)) dto: InternalOrgActionDto,
  ) {
    return this.svc.unsuspend(id, dto.reason);
  }

  // ── Storefront público ────────────────────────────────────────────────────

  @Post(':id/pause-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pausa el storefront público — compradores ven 404' })
  pauseStore(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InternalOrgActionSchema)) dto: InternalOrgActionDto,
  ) {
    return this.svc.pauseStore(id, dto.reason);
  }

  @Post(':id/resume-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactiva el storefront público' })
  resumeStore(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InternalOrgActionSchema)) dto: InternalOrgActionDto,
  ) {
    return this.svc.resumeStore(id, dto.reason);
  }
}
