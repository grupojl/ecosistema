import { trpc } from '@/lib/trpc/client';

export function useFeatureFlags() {
  return trpc.configFlags.list.useQuery(undefined, {
    staleTime: 30_000, refetchInterval: 60_000,
  });
}
export function useUpdateFeatureFlag() {
  const utils = trpc.useUtils();
  return trpc.configFlags.update.useMutation({
    onSettled: () => { void utils.configFlags.list.invalidate(); },
  });
}

export function useQuotas() {
  return trpc.configQuotas.list.useQuery(undefined, {
    staleTime: 30_000, refetchInterval: 30_000,
  });
}
export function useUpdateQuotaLimit() {
  const utils = trpc.useUtils();
  return trpc.configQuotas.updateLimit.useMutation({
    onSuccess: () => { void utils.configQuotas.list.invalidate(); },
  });
}

export function useThemes() {
  return trpc.configThemes.list.useQuery(undefined);
}
export function useActivateTheme() {
  const utils = trpc.useUtils();
  return trpc.configThemes.activate.useMutation({
    onSuccess: () => { void utils.configThemes.list.invalidate(); },
  });
}

export function useWebhooks() {
  return trpc.configWebhooks.list.useQuery(undefined);
}
export function useCreateWebhook() {
  const utils = trpc.useUtils();
  return trpc.configWebhooks.create.useMutation({
    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },
  });
}
export function useDeleteWebhook() {
  const utils = trpc.useUtils();
  return trpc.configWebhooks.remove.useMutation({
    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },
  });
}
export function useWebhookLogs(webhookId: string | null | undefined) {
  return trpc.configWebhooks.getLogs.useQuery(
    { webhookId: webhookId!, take: 50 },
    { enabled: !!webhookId },
  );
}