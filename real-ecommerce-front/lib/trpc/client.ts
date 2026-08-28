/**
 * lib/trpc/client.ts — real-ecommerce-front
 *
 * Cliente tRPC React para el storefront público.
 * Conecta con realsass-ecommerce-back en /api/v1/trpc.
 *
 * Headers por request:
 *   x-organization-id: fijo desde NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID
 *   x-customer-id:     customerId del cliente (CustomerContext, sin Firebase)
 *
 * Sin Authorization — los clientes del storefront no usan Firebase.
 */
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink }   from '@trpc/client';
import type { AppRouter }  from './router-type';

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient(getCustomerId: () => string | null) {
  const orgId = process.env.NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID ?? '';

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? ''}/api/v1/trpc`,
        headers() {
          const customerId = getCustomerId();
          const result: Record<string, string> = {};
          if (orgId)      result['x-organization-id'] = orgId;
          if (customerId) result['x-customer-id']      = customerId;
          return result;
        },
      }),
    ],
  });
}
