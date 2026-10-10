import type { WebhookEndpoint, WebhookDeliveryLog, PersistWebhookInput } from '@/domain/webhook.entity';

export const WEBHOOKS_REPOSITORY = Symbol('WEBHOOKS_REPOSITORY');

/** Las operaciones por id exigen organizationId: un webhook de otra organización se trata como inexistente. */
export interface IWebhooksRepository {
  findAllByOrg(organizationId: string): Promise<WebhookEndpoint[]>;
  findById(id: string, organizationId: string): Promise<WebhookEndpoint | null>;
  create(input: PersistWebhookInput): Promise<WebhookEndpoint>;
  updateSecret(id: string, organizationId: string, secretEncrypted: string, secretHint: string): Promise<boolean>;
  remove(id: string, organizationId: string): Promise<boolean>;
  getLogs(webhookId: string, take: number): Promise<WebhookDeliveryLog[]>;
}
