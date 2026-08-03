/* eslint-disable @typescript-eslint/no-explicit-any */
import { trpc } from '@/lib/trpc/client';

const t = trpc as any;

export function useFeatureFlags() {
  return t.configFlags.list.useQuery(undefined, {
    staleTime: 30_000, refetchInterval: 60_000,
  });
}
export function useUpdateFeatureFlag() {
  const utils = t.useUtils();
  return t.configFlags.update.useMutation({
    onSettled: () => { void utils.configFlags.list.invalidate(); },
  });
}

export function useQuotas() {
  return t.configQuotas.list.useQuery(undefined, {
    staleTime: 30_000, refetchInterval: 30_000,
  });
}
export function useUpdateQuotaLimit() {
  const utils = t.useUtils();
  return t.configQuotas.updateLimit.useMutation({
    onSuccess: () => { void utils.configQuotas.list.invalidate(); },
  });
}

export function useThemes() {
  return t.configThemes.list.useQuery(undefined);
}
export function useActivateTheme() {
  const utils = t.useUtils();
  return t.configThemes.activate.useMutation({
    onSuccess: () => { void utils.configThemes.list.invalidate(); },
  });
}

export function useWebhooks() {
  return t.configWebhooks.list.useQuery(undefined);
}
export function useCreateWebhook() {
  const utils = t.useUtils();
  return t.configWebhooks.create.useMutation({
    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },
  });
}
export function useDeleteWebhook() {
  const utils = t.useUtils();
  return t.configWebhooks.remove.useMutation({
    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },
  });
}
export function useWebhookLogs(webhookId: string | null | undefined) {
  return t.configWebhooks.getLogs.useQuery(
    { webhookId: webhookId!, take: 50 },
    { enabled: !!webhookId },
  );
}