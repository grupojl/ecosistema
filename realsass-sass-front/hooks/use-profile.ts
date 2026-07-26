/**
 * hooks/use-profile.ts
 *
 * Perfil completo del usuario via tRPC.
 * Reemplaza el profile que viene del AuthContext cuando se necesite
 * refetch manual o invalidación después de mutaciones.
 *
 * El AuthContext sigue siendo la fuente de verdad para auth state.
 * Este hook es para operaciones de datos adicionales sobre el perfil.
 */
import { trpc } from '@/lib/trpc/client';

export function useProfile() {
  return trpc.auth.me.useQuery(undefined, {
    staleTime: 60_000,
  });
}

export function useSyncUser() {
  const utils = trpc.useUtils();
  return trpc.auth.sync.useMutation({
    onSuccess: () => void utils.auth.me.invalidate(),
  });
}

export function useSelectRole() {
  const utils = trpc.useUtils();
  return trpc.auth.selectRole.useMutation({
    onSuccess: () => void utils.auth.me.invalidate(),
  });
}
