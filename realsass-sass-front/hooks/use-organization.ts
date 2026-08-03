/* eslint-disable @typescript-eslint/no-explicit-any */
import { trpc } from '@/lib/trpc/client';

const t = trpc as any;

export function useMyOrganization() {
  return t.organizations.me.useQuery(undefined, { staleTime: 60_000 });
}

export function useUpdateOrganization() {
  const utils = t.useUtils();
  return t.organizations.update.useMutation({
    onSuccess: () => {
      void utils.organizations.me.invalidate();
      void utils.auth.me.invalidate();
    },
  });
}