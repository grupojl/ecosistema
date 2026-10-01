import { trpc } from '@/lib/trpc/client';

export function useFlags(organizationId: string | null | undefined) {
  return trpc.configFlags.list.useQuery(undefined, {
    enabled:         !!organizationId,
    staleTime:       30_000,
    refetchInterval: 60_000,
  });
}

export function useUpdateFlag() {
  const utils = trpc.useUtils();
  return trpc.configFlags.update.useMutation({
    onMutate: async (variables) => {
      await utils.configFlags.list.cancel();
      const previous = utils.configFlags.list.getData();
      utils.configFlags.list.setData(undefined, (old) => {
        if (!old) return old;
        const list = Array.isArray(old) ? old : old?.data ?? [];
        const updated = list.map((f) =>
          f.id === variables.flagId
            ? { ...f, ...(variables.enabled !== undefined && { enabled: variables.enabled }) }
            : f,
        );
        return Array.isArray(old) ? updated : { ...old, data: updated };
      });
      return { previous };
    },
    onError: (_err: unknown, _vars: unknown, context) => {
      if (context?.previous !== undefined) {
        utils.configFlags.list.setData(undefined, context.previous);
      }
    },
    onSettled: () => { void utils.configFlags.list.invalidate(); },
  });
}