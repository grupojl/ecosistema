/**
 * lib/trpc/ecommerce-client.ts — realsass-dashboard-front
 *
 * Cliente tRPC React para realsass-ecommerce-back (catálogo, inventario, órdenes).
 * El tipo del router sale de @real/trpc (dist/contracts), nunca del código del back.
 *
 * Auth: cookies HttpOnly (ADR-004) → credentials: 'include'.
 */
import { createTRPCReact }  from '@trpc/react-query';
import { httpBatchLink }    from '@trpc/client';
import type { EcommerceAppRouter } from '@real/trpc';

export const ecommerceTrpc = createTRPCReact<EcommerceAppRouter>();

export function makeEcommerceTrpcClient(
  url:               string,
  getOrganizationId: () => string | null = () => null,
) {
  return ecommerceTrpc.createClient({
    links: [
      httpBatchLink({
        url,
        fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
        headers() {
          const orgId = getOrganizationId();
          return orgId ? { 'x-organization-id': orgId } : {};
        },
      }),
    ],
  });
}
