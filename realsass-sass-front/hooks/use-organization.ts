/**
 * hooks/use-organization.ts
 *
 * Reemplaza las llamadas a:
 *   updateMyOrganization(uid, dto) → trpc.organizations.update
 *
 * La org del usuario se obtiene desde el perfil (auth.me)
 * que ya incluye el campo organization completo.
 */
import { trpc } from '@/lib/trpc/client';

export function useMyOrganization() {
  return trpc.organizations.me.useQuery(undefined, {
    staleTime: 60_000,
  });
}

export function useUpdateOrganization() {
  const utils = trpc.useUtils();
  return trpc.organizations.update.useMutation({
    onSuccess: () => {
      void utils.organizations.me.invalidate();
      void utils.auth.me.invalidate();
    },
  });
}
