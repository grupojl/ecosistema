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

// ── Feature Flags ─────────────────────────────────────────────────────────────

export function useFeatureFlags() {
  return trpc.configFlags.list.useQuery(undefined, {
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
  return trpc.configQuotas.list.useQuery(undefined, {
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
  return trpc.configThemes.list.useQuery(undefined, {
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
  return trpc.configWebhooks.list.useQuery(undefined, {
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
  return trpc.configWebhooks.delete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['configWebhooks', 'list']] });
    },
  });
}

export function useWebhookLogs(webhookId: string | null | undefined) {
  return trpc.configWebhooks.getLogs.useQuery(
    { webhookId: webhookId! },
    {
      enabled:   !!webhookId,
      staleTime: 10 * 1000, // 10s — los logs son más dinámicos
    },
  );
}
