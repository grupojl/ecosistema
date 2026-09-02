/**
 * lib/trpc/server.ts — real-ecommerce-front
 *
 * tRPC server caller para Server Components (RSC).
 * Reemplaza lib/store/client.ts (fetch REST manual).
 *
 * Uso en Server Components:
 *   const caller = createStoreCaller(organizationId)
 *   const products = await caller.customer.getProducts({ organizationId })
 *   const store    = await caller.customer.resolveStore({ slug })
 *
 * Por qué no usamos el cliente React (trpc.customer.*):
 *   Los Server Components no tienen acceso a hooks de React.
 *   El server caller ejecuta el procedure directamente sin HTTP.
 *
 * Cache: Next.js cachea el fetch subyacente — las revalidaciones
 *   se configuran con { next: { revalidate: N } } en el contexto.
 */
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter }                  from './router-type';

function getBackendUrl(): string {
  const url = process.env.ECOMMERCE_BACK_URL ?? process.env.NEXT_PUBLIC_ECOMMERCE_BACK_URL;
  if (!url) throw new Error('ECOMMERCE_BACK_URL no está configurado');
  return url;
}

/**
 * Crea un cliente tRPC server-side para un organizationId dado.
 * Se instancia por request — no cachear entre requests.
 */
export function createStoreCaller(organizationId?: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getBackendUrl()}/api/v1/trpc`,
        headers() {
          return {
            ...(organizationId ? { 'x-organization-id': organizationId } : {}),
          };
        },
      }),
    ],
  });
}
