'use client';
/**
 * lib/trpc/provider.tsx — realsass-dashboard-front
 *
 * Proveedor tRPC del dashboard (sass-back, que también es el back de Welver).
 * Comparte el QueryClient del QueryProvider → el HydrationBoundary de los
 * Server Components y los hooks trpc.* leen el mismo cache.
 * Auth: cookies HttpOnly (ADR-004). Tenant: header x-organization-id.
 */
import { useState }             from 'react';
import { useQueryClient }       from '@tanstack/react-query';
import { getActiveOrganizationId } from '@real/auth-client';
import { trpc, makeTrpcClient } from '@/lib/trpc/client';

const sassTrpcUrl = () => {
  const base = process.env.NEXT_PUBLIC_SASS_BACK_URL ?? process.env.NEXT_PUBLIC_REAL_BACK_URL;
  return base ? `${base.replace(/\/+$/, '').replace(/\/api\/v1$/, '')}/api/v1/trpc` : '/api/v1/trpc';
};

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [sassClient] = useState(() => makeTrpcClient(sassTrpcUrl(), getActiveOrganizationId));

  return (
    <trpc.Provider client={sassClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
