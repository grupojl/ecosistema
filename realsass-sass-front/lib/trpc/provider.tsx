/**
 * lib/trpc/provider.tsx
 *
 * TrpcProvider para realsass-sass-front.
 * Usa useAuth de @/context/auth-context (el contexto existente del front).
 */
'use client';

import { useState }                         from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, createTrpcClient }           from './client';
import { useAuth }                          from '@/context/auth-context';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();

  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime:            60_000,
          retry:                1,
          refetchOnWindowFocus: false,
        },
      },
    }),
  );

  const [trpcClient] = useState(() =>
    createTrpcClient(
      () => firebaseUser?.getIdToken() ?? Promise.resolve(null),
    ),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
