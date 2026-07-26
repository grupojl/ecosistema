/**
 * hooks/use-config.ts
 *
 * Reemplaza lib/config-api para el flujo del owner.
 * Usado actualmente en app/profile/config/page.tsx.
 *
 * Requiere x-organization-id header — el TrpcProvider lo inyecta
 * automáticamente cuando el owner está en el contexto de su org.
 *
 * NOTA: Para pasar organizationId al header tRPC desde este front,
 * el TrpcProvider necesita leerlo del perfil del usuario.
 * Ver lib/trpc/provider.tsx — extender getOrganizationId si es necesario.
 */
import { trpc } from '@/lib/trpc/client';

// ── Feature Flags ─────────────────────────────────────────────────────────────

export function useFeatureFlags() {
  return trpc.configFlags.list.useQuery(undefined, {
    staleTime:       30_000,
    refetchInterval: 60_000,
  });
}

export function useUpdateFeatureFlag() {
  const utils = trpc.useUtils();
  return trpc.configFlags.update.useMutation({
    onMutate: async (variables) => {
      await utils.configFlags.list.cancel();
      const previous = utils.configFlags.list.getData();
      utils.configFlags.list.setData(undefined, (old: any) => {
        if (!old) return old;
        const list = Array.isArray(old) ? old : old?.data ?? [];
        const updated = list.map((f: any) =>
          f.key === variables.flagId
            ? { ...f, ...(variables.enabled !== undefined && { enabled: variables.enabled }) }
            : f,
        );
        return Array.isArray(old) ? updated : { ...old, data: updated };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        utils.configFlags.list.setData(undefined, context.previous);
      }
    },
    onSettled: () => void utils.configFlags.list.invalidate(),
  });
}

// ── Quotas ────────────────────────────────────────────────────────────────────

export function useQuotas() {
  return trpc.configQuotas.list.useQuery(undefined, {
    staleTime:       30_000,
    refetchInterval: 30_000,
  });
}

export function useUpdateQuotaLimit() {
  const utils = trpc.useUtils();
  return trpc.configQuotas.updateLimit.useMutation({
    onSuccess: () => void utils.configQuotas.list.invalidate(),
  });
}

// ── Themes ────────────────────────────────────────────────────────────────────

export function useThemes() {
  return trpc.configThemes.list.useQuery(undefined);
}

export function useActivateTheme() {
  const utils = trpc.useUtils();
  return trpc.configThemes.activate.useMutation({
    onSuccess: () => void utils.configThemes.list.invalidate(),
  });
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export function useWebhooks() {
  return trpc.configWebhooks.list.useQuery(undefined);
}

export function useCreateWebhook() {
  const utils = trpc.useUtils();
  return trpc.configWebhooks.create.useMutation({
    onSuccess: () => void utils.configWebhooks.list.invalidate(),
  });
}

export function useDeleteWebhook() {
  const utils = trpc.useUtils();
  return trpc.configWebhooks.remove.useMutation({
    onSuccess: () => void utils.configWebhooks.list.invalidate(),
  });
}

export function useWebhookLogs(webhookId: string | null | undefined) {
  return trpc.configWebhooks.getLogs.useQuery(
    { webhookId: webhookId!, take: 50 },
    { enabled: !!webhookId },
  );
}
