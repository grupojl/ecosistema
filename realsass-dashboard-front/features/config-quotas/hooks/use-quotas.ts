import { trpc } from '@/lib/trpc/client';

export function useQuotas(organizationId?: string | null) {
  return trpc.configQuotas.list.useQuery(undefined, {
    enabled:         !!organizationId,
    staleTime:       30_000,
    refetchInterval: 30_000,
  });
}

export function useUpdateQuotaLimit() {
  const utils = trpc.useUtils();
  return trpc.configQuotas.updateLimit.useMutation({
    onSuccess: () => { void utils.configQuotas.list.invalidate(); },
  });
}