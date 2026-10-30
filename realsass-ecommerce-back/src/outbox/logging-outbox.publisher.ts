import { Injectable, Logger } from '@nestjs/common';
import type { OutboxEventRecord, OutboxPublisher } from '@/outbox/outbox.types';

/**
 * Publisher por defecto: solo registra el evento. Cuando exista un consumidor real (WhatsApp, notificaciones,
 * facturación) se reemplaza el provider OUTBOX_PUBLISHER; el relay y la tabla no cambian.
 */
@Injectable()
export class LoggingOutboxPublisher implements OutboxPublisher {
  private readonly logger = new Logger('Outbox');

  async publish(event: OutboxEventRecord): Promise<void> {
    this.logger.log(
      `${event.type} ${event.aggregateType}:${event.aggregateId} org=${event.organizationId} id=${event.id}`,
    );
  }
}
