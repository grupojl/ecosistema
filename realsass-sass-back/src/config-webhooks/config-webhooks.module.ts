import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigWebhooksService } from '@/config-webhooks/config-webhooks.service';
import {
  WebhookDeliveryService,
  WEBHOOK_QUEUE,
} from '@/config-webhooks/webhook-delivery.service';
import { WebhookDeliveryProcessor } from '@/config-webhooks/webhook-delivery.processor';
import { PrismaWebhooksRepository } from '@/config-webhooks/repository/prisma-webhooks.repository';
import { WEBHOOKS_REPOSITORY } from '@/config-webhooks/repository/webhooks.repository.interface';
import { PrismaModule } from '@/prisma/prisma.module';
import { ConfigAuditModule } from '@/config-audit/config-audit.module';
import { ConfigSecretsModule } from '@/config-secrets/config-secrets.module';

/**
 * WEBHOOK_QUEUE_ENABLED=false (solo desarrollo sin Redis): no se registra la cola ni el worker de BullMQ, así no intentan
 * conectarse. Los webhooks no se entregan (dispatch queda en no-op). Por defecto está ENCENDIDA: producción no cambia.
 */
const queueEnabled = process.env['WEBHOOK_QUEUE_ENABLED'] !== 'false';

@Module({
  imports: [
    PrismaModule,
    ConfigAuditModule,
    ConfigSecretsModule, // CryptoService: cifra/descifra el secreto de firma
    ...(queueEnabled ? [BullModule.registerQueue({ name: WEBHOOK_QUEUE })] : []),
  ],

  providers: [
    ConfigWebhooksService,
    WebhookDeliveryService,
    ...(queueEnabled ? [WebhookDeliveryProcessor] : []),
    { provide: WEBHOOKS_REPOSITORY, useClass: PrismaWebhooksRepository },
  ],
  exports: [ConfigWebhooksService, WebhookDeliveryService],
})
export class ConfigWebhooksModule {}
