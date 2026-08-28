import { Module }                    from '@nestjs/common';
import { BullModule }                from '@nestjs/bullmq';
import { ConfigWebhooksController }  from './config-webhooks.controller';
import { ConfigWebhooksService }     from './config-webhooks.service';
import { WebhookDeliveryService, WEBHOOK_QUEUE } from './webhook-delivery.service';
import { WebhookDeliveryProcessor }  from './webhook-delivery.processor';
import { PrismaWebhooksRepository }  from './repository/prisma-webhooks.repository';
import { WEBHOOKS_REPOSITORY }       from './repository/webhooks.repository.interface';
import { PrismaModule }              from '../prisma/prisma.module';
import { ConfigAuditModule }         from '../config-audit/config-audit.module';

@Module({
  imports: [
    PrismaModule,
    ConfigAuditModule,
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  controllers: [ConfigWebhooksController],
  providers:   [
    ConfigWebhooksService,
    WebhookDeliveryService,
    WebhookDeliveryProcessor,
    { provide: WEBHOOKS_REPOSITORY, useClass: PrismaWebhooksRepository },
  ],
  exports: [ConfigWebhooksService, WebhookDeliveryService],
})
export class ConfigWebhooksModule {}
