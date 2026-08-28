import type { WebhookEndpoint, WebhookDeliveryLog, CreateWebhookInput } from '../domain/webhook.entity';

export const WEBHOOKS_REPOSITORY = Symbol('WEBHOOKS_REPOSITORY');

export interface IWebhooksRepository {
  findAllByOrg(organizationId: string): Promise<WebhookEndpoint[]>;
  findById(id: string): Promise<WebhookEndpoint | null>;
  create(input: CreateWebhookInput): Promise<WebhookEndpoint>;
  remove(id: string): Promise<void>;
  getLogs(webhookId: string, take: number): Promise<WebhookDeliveryLog[]>;
}
