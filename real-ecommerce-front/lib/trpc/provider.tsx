/**
 * lib/trpc/provider.tsx
 *
 * TrpcProvider para real-ecommerce-front.
 * Lee el customerId desde CustomerContext para inyectarlo en los headers.
 * Debe ir DENTRO de CustomerProvider en el árbol de componentes.
 */
'use client';

import { useState }                         from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, createTrpcClient }           from './client';
import { useCustomerContext }               from '@/context/customer-context';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const { customerId } = useCustomerContext();

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
    createTrpcClient(() => customerId),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
