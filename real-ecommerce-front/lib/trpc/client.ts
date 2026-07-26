/**
 * lib/trpc/client.ts
 *
 * Cliente tRPC para real-ecommerce-front (zona autenticada del storefront).
 * Conecta con realsass-ecommerce-back en /api/v1/trpc.
 *
 * Headers por request:
 *   x-organization-id: NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID (fijo para este storefront)
 *   x-customer-id:     customerId del cliente logueado (de CustomerContext)
 *
 * No usa Firebase — los clientes del storefront se identifican con
 * su customerId obtenido tras llamar a /customers/identify (REST público).
 */
'use client';

import { createTRPCReact }        from '@trpc/react-query';
import { httpBatchLink }          from '@trpc/client';
import type { EcommerceAppRouter } from '@real/trpc-contract';

export const trpc = createTRPCReact<EcommerceAppRouter>();

const ORG_ID = process.env['NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID'] ?? '';

export function createTrpcClient(getCustomerId: () => string | null) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env['NEXT_PUBLIC_ECOMMERCE_API_URL']}/trpc`,
        headers() {
          const customerId = getCustomerId();
          return {
            'x-organization-id': ORG_ID,
            ...(customerId ? { 'x-customer-id': customerId } : {}),
          };
        },
      }),
    ],
  });
}
