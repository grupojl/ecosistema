'use client';
/**
 * lib/trpc/provider.tsx — realsass-dashboard-front
 *
 * Proveedores tRPC del dashboard (sass-back + ecommerce-back).
 * Comparten el QueryClient del QueryProvider → el HydrationBoundary de los
 * Server Components y los hooks trpc.* leen el mismo cache.
 * Auth: cookies HttpOnly (ADR-004). Tenant: header x-organization-id.
 */
import { useState }             from 'react';
import { useQueryClient }       from '@tanstack/react-query';
import { getActiveOrganizationId } from '@real/auth-client';
import { trpc, makeTrpcClient } from '@/lib/trpc/client';
import { ecommerceTrpc, makeEcommerceTrpcClient } from '@/lib/trpc/ecommerce-client';

const sassTrpcUrl = () =>
  process.env.NEXT_PUBLIC_REAL_BACK_URL
    ? `${process.env.NEXT_PUBLIC_REAL_BACK_URL}/api/v1/trpc`
    : '/api/v1/trpc';

const ecommerceTrpcUrl = () => {
  const base = process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? process.env.NEXT_PUBLIC_ECOMMERCE_BACK_URL;
  return base ? `${base.replace(/\/+$/, '')}/api/v1/trpc` : '/api/v1/trpc';
};

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [sassClient]      = useState(() => makeTrpcClient(sassTrpcUrl(), getActiveOrganizationId));
  const [ecommerceClient] = useState(() => makeEcommerceTrpcClient(ecommerceTrpcUrl(), getActiveOrganizationId));

  return (
    <trpc.Provider client={sassClient} queryClient={queryClient}>
      <ecommerceTrpc.Provider client={ecommerceClient} queryClient={queryClient}>
        {children}
      </ecommerceTrpc.Provider>
    </trpc.Provider>
  );
}
