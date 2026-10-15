/**
 * lib/trpc/provider.tsx
 *
 * TrpcProvider para real-ecommerce-front.
 * La sesión del cliente viaja en una cookie HttpOnly: el provider no maneja ningún token.
 */
'use client';

import { useState }                         from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, createTrpcClient }           from '@/lib/trpc/client';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime:            30_000,
          retry:                1,
          refetchOnWindowFocus: false,
        },
      },
    }),
  );

  const [trpcClient] = useState(() =>
    createTrpcClient(),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
