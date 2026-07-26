import { Module }                    from '@nestjs/common';
import { BullModule }                from '@nestjs/bullmq';
import { ConfigWebhooksController }  from './config-webhooks.controller';
import { ConfigWebhooksService }     from './config-webhooks.service';
import { WebhookDeliveryService, WEBHOOK_QUEUE } from './webhook-delivery.service';
import { WebhookDeliveryProcessor }  from './webhook-delivery.processor';
import { ConfigAuditModule }         from '../config-audit/config-audit.module';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    ConfigAuditModule,
    ...(REDIS_ENABLED ? [BullModule.registerQueue({ name: WEBHOOK_QUEUE })] : []),
  ],
  controllers: [ConfigWebhooksController],
  providers: [
    ConfigWebhooksService,
    WebhookDeliveryService,
    ...(REDIS_ENABLED ? [WebhookDeliveryProcessor] : []),
  ],
  exports: [ConfigWebhooksService, WebhookDeliveryService],
})
export class ConfigWebhooksModule {}
