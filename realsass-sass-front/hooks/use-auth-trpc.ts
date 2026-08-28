/**
 * hooks/use-auth-trpc.ts — realsass-sass-front
 *
 * Hooks TanStack Query para auth vía tRPC.
 * Reemplaza las llamadas REST manuales de lib/api.ts para auth.
 *
 * Por qué TanStack Query para auth:
 *   - Cache automático del perfil — no re-fetch en cada render
 *   - Invalidación explícita cuando cambia la org activa
 *   - Type-safety completo desde SassAppRouter
 *   - Estados loading/error/data tipados
 */
import { useQueryClient }  from '@tanstack/react-query';
import { trpc }            from '@/lib/trpc/client';

// ── auth.me — perfil completo cacheado ───────────────────────────────────────

export function useMe() {
  return trpc.auth.me.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,  // 5 min — el perfil no cambia frecuentemente
    retry:     1,
  });
}

// ── auth.sync — upsert tras login ────────────────────────────────────────────

export function useSyncUser() {
  const queryClient = useQueryClient();

  return trpc.auth.sync.useMutation({
    onSuccess: () => {
      // Invalidar el perfil cacheado para que auth.me re-fetche con datos frescos
      queryClient.invalidateQueries({ queryKey: [['auth', 'me']] });
    },
  });
}

// ── auth.refreshClaims — reemitir claims al cambiar de org ───────────────────

export function useRefreshClaims() {
  return trpc.auth.refreshClaims.useMutation();
}

// ── auth.selectRole — seleccionar org activa ─────────────────────────────────

export function useSelectRole() {
  const queryClient = useQueryClient();

  return trpc.auth.selectRole.useMutation({
    onSuccess: () => {
      // Invalidar perfil — el rol cambió, los datos pueden ser distintos
      queryClient.invalidateQueries({ queryKey: [['auth', 'me']] });
    },
  });
}
