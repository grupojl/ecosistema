import { trpc } from '@/lib/trpc/client';

export function useThemes(organizationId?: string | null) {
  return trpc.configThemes.list.useQuery(undefined, {
    enabled: !!organizationId,
  });
}

export function useActivateTheme() {
  const utils = trpc.useUtils();
  return trpc.configThemes.activate.useMutation({
    onSuccess: () => { void utils.configThemes.list.invalidate(); },
  });
}

export function useCreateTheme() {
  const utils = trpc.useUtils();
  return trpc.configThemes.update.useMutation({
    onSuccess: () => { void utils.configThemes.list.invalidate(); },
  });
}

export function useDeleteTheme() {
  return {
    mutateAsync: async (_themeId: string) => {
      throw new Error('configThemes.delete no implementado en el router aún');
    },
    isPending: false,
  };
}