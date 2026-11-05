/**
 * Tipos compartidos de los servicios de Welver. El actor sale SIEMPRE del contexto validado de tRPC
 * (organización y rol resueltos por el middleware de auth), nunca del input.
 */
export interface WelverActor {
  organizationId: string;
  uid: string;
  role: 'OWNER' | 'COLLABORATOR';
}

export const WELVER_FLAGS = {
  api: 'welver.api',
  widget: 'welver.widget',
  voice: 'welver.voice',
  auditor: 'welver.auditor',
  approval: 'welver.approval',
} as const;

export const MESSAGES_QUOTA_RESOURCE = 'messages';
