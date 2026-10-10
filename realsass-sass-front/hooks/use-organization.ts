import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/context/auth-context';

export function useMyOrganization() {
  const { sessionReady } = useAuth();
  return trpc.organizations.me.useQuery(undefined, { staleTime: 60_000, enabled: sessionReady });
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
