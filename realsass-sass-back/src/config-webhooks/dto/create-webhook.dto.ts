import type { CreateWebhookInput } from '@/config-webhooks/domain/webhook.entity';
// organizationId lo inyecta el service desde el contexto de tenant, no viene del cliente.
export type CreateWebhookDto = Omit<CreateWebhookInput, 'organizationId'>;
