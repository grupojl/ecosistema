import { Module }                    from '@nestjs/common';
import { BullModule }                from '@nestjs/bullmq';
import { ConfigWebhooksService }     from '@/config-webhooks/config-webhooks.service';
import { WebhookDeliveryService, WEBHOOK_QUEUE } from '@/config-webhooks/webhook-delivery.service';
import { WebhookDeliveryProcessor }  from '@/config-webhooks/webhook-delivery.processor';
import { PrismaWebhooksRepository }  from '@/config-webhooks/repository/prisma-webhooks.repository';
import { WEBHOOKS_REPOSITORY }       from '@/config-webhooks/repository/webhooks.repository.interface';
import { PrismaModule }              from '@/prisma/prisma.module';
import { ConfigAuditModule }         from '@/config-audit/config-audit.module';

@Module({
  imports: [
    PrismaModule,
    ConfigAuditModule,
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  
  providers:   [
    ConfigWebhooksService,
    WebhookDeliveryService,
    WebhookDeliveryProcessor,
    { provide: WEBHOOKS_REPOSITORY, useClass: PrismaWebhooksRepository },
  ],
  exports: [ConfigWebhooksService, WebhookDeliveryService],
})
export class ConfigWebhooksModule {}
