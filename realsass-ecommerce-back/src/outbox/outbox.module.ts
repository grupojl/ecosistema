import { Module } from '@nestjs/common';
import { LoggingOutboxPublisher } from '@/outbox/logging-outbox.publisher';
import { WebhookOutboxPublisher } from '@/outbox/webhook-outbox.publisher';
import { OutboxRelayService } from '@/outbox/outbox-relay.service';
import { OutboxService } from '@/outbox/outbox.service';
import { OUTBOX_PUBLISHER } from '@/outbox/outbox.types';

@Module({
  providers: [
    OutboxService,
    OutboxRelayService,
    // OUTBOX_PUBLISHER=logging deja solo el registro (útil en desarrollo); por defecto entrega a los webhooks de la organización.
    {
      provide: OUTBOX_PUBLISHER,
      useClass:
        process.env['OUTBOX_PUBLISHER'] === 'logging'
          ? LoggingOutboxPublisher
          : WebhookOutboxPublisher,
    },
  ],
  exports: [OutboxService, OutboxRelayService],
})
export class OutboxModule {}
