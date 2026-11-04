import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Public } from '@real/auth-server';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard';
import { InternalEventSchema, type InternalEventDto } from '@/internal/schemas';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { WebhookDeliveryService } from '@/config-webhooks/webhook-delivery.service';

/**
 * Entrada de eventos de dominio de otros servicios (outbox del ecommerce-back, ADR-029) hacia los webhooks salientes
 * de la organización. Servicio-a-servicio: protegido por INTERNAL_API_KEY. Idempotente por `eventId`.
 */
@Public()
@UseGuards(InternalApiKeyGuard)
// DT-STORE-1: servicio-a-servicio (INTERNAL_API_KEY). No cae en el limitador `auth` (pensado para login) y tiene un tope
// propio holgado: todo el tráfico del storefront sale de pocas IPs y el 30/min global lo cortaría.
@SkipThrottle({ auth: true })
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('internal/organizations')
export class InternalEventsController {
  constructor(private readonly delivery: WebhookDeliveryService) {}

  @Post(':id/events')
  @HttpCode(HttpStatus.ACCEPTED)
  async publish(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InternalEventSchema)) dto: InternalEventDto,
  ): Promise<{ accepted: true }> {
    await this.delivery.dispatch(id, dto.type, dto.payload, dto.eventId);
    return { accepted: true };
  }
}
