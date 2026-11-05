// config/constants.ts

// NEXT_PUBLIC_SASS_BACK_URL manda; NEXT_PUBLIC_REAL_BACK_URL queda como respaldo (el Dockerfile aún solo define esa).
export const REAL_BACK_URL     = process.env.NEXT_PUBLIC_SASS_BACK_URL ?? process.env.NEXT_PUBLIC_REAL_BACK_URL ?? '';

// ─── TanStack Query keys ──────────────────────────────────────────────────────

export const QUERY_KEYS = {
  // Auth / perfil
  me:              ['me']               as const,
  // Config — real-back
  configThemes:    ['config-themes']    as const,
  configFlags:     ['config-flags']     as const,
  configWebhooks:  ['config-webhooks']  as const,
  configWebhookLogs: ['config-wh-logs'] as const,
  configQuotas:    ['config-quotas']    as const,
  // Módulos futuros
  conversaciones:  ['conversaciones']   as const,
  mensajes:        ['mensajes']         as const,
  balance:         ['balance']          as const,
  transacciones:   ['transacciones']    as const,
  campanas:        ['campanas']         as const,
  metricasCampana: ['metricas-campana'] as const,
} as const;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE     = 100;
