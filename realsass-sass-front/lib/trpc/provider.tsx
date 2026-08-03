'use client';

import { useState, type ReactNode }          from 'react';
import { QueryClient, QueryClientProvider }  from '@tanstack/react-query';
import { TRPCClientError }                   from '@trpc/client';
import { trpc, makeTrpcClient }              from './client';
import { useAuth }                           from '@/context/auth-context';

export function TrpcProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    },
  }));

  const url = `${process.env['NEXT_PUBLIC_API_URL'] ?? ''}/trpc`;

  const [trpcClient] = useState(() =>
    (trpc as any).createClient(makeTrpcClient(
      url,
      () => firebaseUser?.getIdToken() ?? Promise.resolve(null),
    )),
  );

  const TrpcProviderComponent = (trpc as any).Provider;

  return (
    <TrpcProviderComponent client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </TrpcProviderComponent>
  );
}
