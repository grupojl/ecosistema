import { Injectable } from '@nestjs/common';
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import type { OutboxEventRecord, OutboxPublisher } from '@/outbox/outbox.types';

/**
 * Publisher real del outbox (ADR-029, DT-EVT-1): entrega cada evento de dominio (order.created, order.paid…) a los
 * webhooks salientes de la organización, a través del sass-back (dueño de los endpoints y de la cola de entrega).
 * El `id` del evento viaja como `eventId`: el sass-back no encola dos veces el mismo, así que el reintento del relay
 * (at-least-once) es seguro. Si el sass-back no responde, lanza y el relay reintenta con espera creciente.
 */
@Injectable()
export class WebhookOutboxPublisher implements OutboxPublisher {
  constructor(private readonly orgs: OrganizationsClientService) {}

  async publish(event: OutboxEventRecord): Promise<void> {
    await this.orgs.publishEvent(event.organizationId, {
      eventId: event.id,
      type: event.type,
      payload: event.payload,
    });
  }
}
