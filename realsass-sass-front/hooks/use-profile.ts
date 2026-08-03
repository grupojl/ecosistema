/* eslint-disable @typescript-eslint/no-explicit-any */
import { trpc } from '@/lib/trpc/client';

const t = trpc as any;

export function useProfile() {
  return t.auth.me.useQuery(undefined, { staleTime: 60_000 });
}

export function useSyncUser() {
  return t.auth.sync.useMutation({});
}

export function useSelectRole() {
  const utils = t.useUtils();
  return t.auth.selectRole.useMutation({
    onSuccess: () => { void utils.auth.me.invalidate(); },
  });
}