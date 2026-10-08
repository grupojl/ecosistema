/**
 * features/config-themes/hooks/use-themes.ts
 *
 * useThemes(orgId)      → trpc.configThemes.list
 * useCreateTheme()      → trpc.configThemes.create
 * useActivateTheme()    → trpc.configThemes.activate
 * useDeleteTheme()      → trpc.configThemes.remove
 */
import { trpc } from '@/lib/trpc/client';

export function useThemes(organizationId: string | null | undefined) {
  return trpc.configThemes.list.useQuery(undefined, { enabled: !!organizationId });
}

export function useActivateTheme() {
  const utils = trpc.useUtils();
  return trpc.configThemes.activate.useMutation({
    onSuccess: () => { void utils.configThemes.list.invalidate(); },
  });
}

export function useCreateTheme() {
  const utils = trpc.useUtils();
  return trpc.configThemes.create.useMutation({
    onSuccess: () => { void utils.configThemes.list.invalidate(); },
  });
}

export function useDeleteTheme() {
  const utils = trpc.useUtils();
  return trpc.configThemes.remove.useMutation({
    onSuccess: () => { void utils.configThemes.list.invalidate(); },
  });
}
