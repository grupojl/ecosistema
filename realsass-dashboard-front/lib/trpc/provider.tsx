'use client';
/**
 * lib/trpc/provider.tsx — realsass-dashboard-front
 *
 * Proveedor tRPC + TanStack Query para el dashboard de colaboradores.
 * Conecta con realsass-sass-back vía cookies HttpOnly (ADR-004).
 */
import { useState }             from 'react';
import { QueryClient }          from '@tanstack/react-query';
import { trpc, makeTrpcClient } from '@/lib/trpc/client';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient]  = useState(() =>
    makeTrpcClient(
      process.env.NEXT_PUBLIC_REAL_BACK_URL
        ? `${process.env.NEXT_PUBLIC_REAL_BACK_URL}/api/v1/trpc`
        : '/api/v1/trpc',
    ),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
