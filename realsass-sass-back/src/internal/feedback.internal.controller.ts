import { SkipThrottle, Throttle } from '@nestjs/throttler';
// realsass-sass-back/src/internal/feedback.internal.controller.ts
//
// Cola de triage de reportes de usuario para superadmin (ADR-027). Protegido por InternalApiKeyGuard.
// Superadmin lee y actualiza; `internalNote` nunca llega al usuario (el tRPC no la selecciona).
import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Public } from '@real/auth-server';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { FeedbackService } from '@/feedback/feedback.service';
import {
  InternalListFeedbackSchema,
  InternalUpdateFeedbackSchema,
  type InternalListFeedbackDto,
  type InternalUpdateFeedbackDto,
} from '@/feedback/feedback.schemas';

@ApiTags('internal')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@Public() // acá manda InternalApiKeyGuard, no Firebase
@UseGuards(InternalApiKeyGuard)
// DT-STORE-1: servicio-a-servicio (INTERNAL_API_KEY). No cae en el limitador `auth` (pensado para login) y tiene un tope
// propio holgado: todo el tráfico del storefront sale de pocas IPs y el 30/min global lo cortaría.
@SkipThrottle({ auth: true })
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('internal/feedback')
export class FeedbackInternalController {
  constructor(private readonly svc: FeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'Lista reportes de usuario — paginada con filtros' })
  list(
    @Query(new ZodValidationPipe(InternalListFeedbackSchema))
    dto: InternalListFeedbackDto,
  ) {
    return this.svc.internalList(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de un reporte (incluye contexto y diagnóstico)',
  })
  get(@Param('id') id: string) {
    return this.svc.internalGet(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cambia estado y/o nota interna' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InternalUpdateFeedbackSchema))
    dto: InternalUpdateFeedbackDto,
  ) {
    return this.svc.internalUpdate(id, dto);
  }
}
