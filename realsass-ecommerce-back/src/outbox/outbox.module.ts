import { Module } from '@nestjs/common';
import { LoggingOutboxPublisher } from '@/outbox/logging-outbox.publisher';
import { OutboxRelayService } from '@/outbox/outbox-relay.service';
import { OutboxService } from '@/outbox/outbox.service';
import { OUTBOX_PUBLISHER } from '@/outbox/outbox.types';

@Module({
  providers: [
    OutboxService,
    OutboxRelayService,
    { provide: OUTBOX_PUBLISHER, useClass: LoggingOutboxPublisher },
  ],
  exports: [OutboxService, OutboxRelayService],
})
export class OutboxModule {}
