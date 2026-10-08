// features/config/types.ts
// ─── Tipos del Config Service — inferidos del contrato SassAppRouter (@real/trpc) ───
// Nada escrito a mano: si sass-back cambia un shape, el dashboard deja de compilar.
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { SassAppRouter } from '@real/trpc';

type RouterOutputs = inferRouterOutputs<SassAppRouter>;
type RouterInputs  = inferRouterInputs<SassAppRouter>;

export type ThemeConfig       = RouterOutputs['configThemes']['list'][number];
export type CreateThemeInput  = RouterInputs['configThemes']['create'];

export type FeatureFlag       = RouterOutputs['configFlags']['list'][number];
export type UpdateFlagInput   = Omit<RouterInputs['configFlags']['update'], 'flagId'>;

export type WebhookEndpoint     = RouterOutputs['configWebhooks']['list'][number];
export type CreateWebhookInput  = RouterInputs['configWebhooks']['create'];
export type WebhookDeliveryLog  = RouterOutputs['configWebhooks']['getLogs'][number];

export type QuotaConfig       = RouterOutputs['configQuotas']['list'][number];

// Eventos disponibles del config service para webhooks
export const WEBHOOK_EVENTS = [
  { key: 'config.changed',   label: 'Configuración cambiada' },
  { key: 'member.joined',    label: 'Miembro se unió' },
  { key: 'member.removed',   label: 'Miembro removido' },
  { key: 'quota.exceeded',   label: 'Quota excedida' },
  { key: 'secret.rotated',   label: 'Secreto rotado' },
  { key: 'flag.changed',     label: 'Feature flag cambiado' },
  { key: 'webhook.test',     label: 'Prueba de webhook' },
  { key: '*',                label: 'Todos los eventos' },
] as const

export const QUOTA_RESOURCE_LABELS: Record<string, string> = {
  members:           'Colaboradores',
  api_keys:          'API Keys',
  monthly_api_calls: 'Llamadas API / mes',
  storage_mb:        'Almacenamiento (MB)',
  chat_messages:     'Mensajes de chat',
  ad_campaigns:      'Campañas publicitarias',
}
