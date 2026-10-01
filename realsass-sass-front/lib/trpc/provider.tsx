'use client';
/**
 * lib/trpc/provider.tsx — realsass-sass-front
 *
 * Proveedor tRPC + TanStack Query para el dashboard de dueños.
 * Usa cookies HttpOnly (ADR-004) — sin Bearer token en headers.
 */
import { useState }        from 'react';
import { QueryClient }     from '@tanstack/react-query';
import { trpc, makeTrpcClient } from '@/lib/trpc/client';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient]  = useState(() =>
    makeTrpcClient(
      process.env.NEXT_PUBLIC_SASS_BACK_URL
        ? `${process.env.NEXT_PUBLIC_SASS_BACK_URL}/api/v1/trpc`
        : '/api/v1/trpc',
    ),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
