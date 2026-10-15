/**
 * lib/trpc/client.ts — real-ecommerce-front
 *
 * Cliente tRPC React para el storefront público.
 * Conecta con realsass-ecommerce-back en /api/v1/trpc.
 *
 * Headers por request:
 *   x-organization-id: fijo desde NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID
 *   Cookie HttpOnly store_session: sesión firmada del cliente (la manda el navegador con
 *   credentials: 'include'; el JavaScript no la ve).
 *
 * Sin Authorization — los clientes del storefront no usan Firebase.
 */
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink }   from '@trpc/client';
import type { AppRouter }  from '@/lib/trpc/router-type';

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  const orgId = process.env.NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID ?? '';

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? ''}/api/v1/trpc`,
        // La cookie de sesión del cliente (HttpOnly) viaja sola con credentials: 'include'.
        fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
        headers() {
          const result: Record<string, string> = {};
          if (orgId)      result['x-organization-id'] = orgId;
          return result;
        },
      }),
    ],
  });
}
