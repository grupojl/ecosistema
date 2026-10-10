import { Module }                    from '@nestjs/common';
import { BullModule }                from '@nestjs/bullmq';
import { ConfigWebhooksService }     from '@/config-webhooks/config-webhooks.service';
import { WebhookDeliveryService, WEBHOOK_QUEUE } from '@/config-webhooks/webhook-delivery.service';
import { WebhookDeliveryProcessor }  from '@/config-webhooks/webhook-delivery.processor';
import { PrismaWebhooksRepository }  from '@/config-webhooks/repository/prisma-webhooks.repository';
import { WEBHOOKS_REPOSITORY }       from '@/config-webhooks/repository/webhooks.repository.interface';
import { PrismaModule }              from '@/prisma/prisma.module';
import { ConfigAuditModule }         from '@/config-audit/config-audit.module';
import { ConfigSecretsModule }       from '@/config-secrets/config-secrets.module';

@Module({
  imports: [
    PrismaModule,
    ConfigAuditModule,
    ConfigSecretsModule, // CryptoService: cifra/descifra el secreto de firma
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
