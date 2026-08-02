import { trpc } from '@/lib/trpc/client';

export function useProfile() {
  return trpc.auth.me.useQuery(undefined, {
    staleTime: 60_000,
  });
}

export function useSyncUser() {
  return trpc.auth.sync.useMutation({});
}

export function useSelectRole() {
  const utils = trpc.useUtils();
  return trpc.auth.selectRole.useMutation({
    onSuccess: () => { void utils.auth.me.invalidate(); },
  });
}