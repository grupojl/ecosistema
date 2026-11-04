import { trpc } from '@/lib/trpc/client';

/** Configuración general y del storefront de la organización activa (`settings.get`). */
export function useOrgSettings(organizationId?: string | null) {
  return trpc.settings.get.useQuery(undefined, {
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}

export function useUpdateGeneralSettings() {
  const utils = trpc.useUtils();
  return trpc.settings.updateGeneral.useMutation({
    onSuccess: () => { void utils.settings.get.invalidate(); },
  });
}

export function useUpdateStorefrontSettings() {
  const utils = trpc.useUtils();
  return trpc.settings.updateStorefront.useMutation({
    onSuccess: () => { void utils.settings.get.invalidate(); },
  });
}
