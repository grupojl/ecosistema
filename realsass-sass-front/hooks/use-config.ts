/**
 * hooks/use-config.ts — realsass-sass-front
 *
 * Hooks TanStack Query para configuración de organización.
 * Tipado completo inferido desde SassAppRouter — sin any implícito.
 *
 * Los tipos se infieren automáticamente de trpc.* — si el back cambia
 * el contrato, TypeScript lo detecta aquí antes de llegar a producción.
 */
import { useQueryClient } from '@tanstack/react-query';
import { trpc }           from '@/lib/trpc/client';
import { useAuth }         from '@/context/auth-context';

// ── Feature Flags ─────────────────────────────────────────────────────────────

export function useFeatureFlags() {
  const { sessionReady } = useAuth();
  return trpc.configFlags.list.useQuery(undefined, {
    enabled:   sessionReady,
    staleTime: 30 * 1000, // 30s — los flags cambian poco pero impactan la UI
  });
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();
  return trpc.configFlags.update.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['configFlags', 'list']] });
    },
  });
}

// ── Quotas ────────────────────────────────────────────────────────────────────

export function useQuotas() {
  const { sessionReady } = useAuth();
  return trpc.configQuotas.list.useQuery(undefined, {
    enabled:   sessionReady,
    staleTime: 60 * 1000, // 1 min — las quotas no cambian frecuentemente
  });
}

export function useUpdateQuotaLimit() {
  const queryClient = useQueryClient();
  return trpc.configQuotas.updateLimit.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['configQuotas', 'list']] });
    },
  });
}

// ── Themes ────────────────────────────────────────────────────────────────────

export function useThemes() {
  const { sessionReady } = useAuth();
  return trpc.configThemes.list.useQuery(undefined, {
    enabled:   sessionReady,
    staleTime: 5 * 60 * 1000, // 5 min — los temas cambian muy poco
  });
}

export function useActivateTheme() {
  const queryClient = useQueryClient();
  return trpc.configThemes.activate.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['configThemes', 'list']] });
    },
  });
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export function useWebhooks() {
  const { sessionReady } = useAuth();
  return trpc.configWebhooks.list.useQuery(undefined, {
    enabled:   sessionReady,
    staleTime: 30 * 1000,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return trpc.configWebhooks.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['configWebhooks', 'list']] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return trpc.configWebhooks.remove.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['configWebhooks', 'list']] });
    },
  });
}

export function useWebhookLogs(webhookId: string | null | undefined) {
  const { sessionReady } = useAuth();
  return trpc.configWebhooks.getLogs.useQuery(
    { webhookId: webhookId! },
    {
      enabled:   !!webhookId && sessionReady,
      staleTime: 10 * 1000, // 10s — los logs son más dinámicos
    },
  );
}

// ── Webhooks: secreto de firma, prueba ────────────────────────────────────────

export function useRotateWebhookSecret() {
  return trpc.configWebhooks.rotateSecret.useMutation();
}

export function useTestWebhook() {
  const queryClient = useQueryClient();
  return trpc.configWebhooks.test.useMutation({
    onSuccess: () => {
      // La entrega es asíncrona (cola): se refrescan los logs para ver el resultado.
      queryClient.invalidateQueries({ queryKey: [['configWebhooks', 'getLogs']] });
    },
  });
}

// ── Secretos (claves sensibles): el valor nunca vuelve del servidor ───────────

export function useSecrets() {
  const { sessionReady } = useAuth();
  return trpc.configSecrets.list.useQuery(undefined, {
    enabled:   sessionReady,
    staleTime: 30 * 1000,
  });
}

export function useCreateSecret() {
  const queryClient = useQueryClient();
  return trpc.configSecrets.create.useMutation({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [['configSecrets', 'list']] }); },
  });
}

export function useRotateSecret() {
  const queryClient = useQueryClient();
  return trpc.configSecrets.rotate.useMutation({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [['configSecrets', 'list']] }); },
  });
}

export function useRevokeSecret() {
  const queryClient = useQueryClient();
  return trpc.configSecrets.revoke.useMutation({
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [['configSecrets', 'list']] }); },
  });
}
