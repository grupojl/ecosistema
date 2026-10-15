/**
 * lib/trpc/browser.ts — real-ecommerce-front
 *
 * Cliente tRPC "vanilla" (sin React) que corre en el NAVEGADOR con credentials: 'include'.
 *
 * Lo necesitan los procedures que setean/borran la cookie de sesión del cliente (customer.identify,
 * customer.logout): el Set-Cookie solo lo puede guardar el navegador, así que no sirven con el server
 * caller de RSC (lib/trpc/server.ts). El token queda en una cookie HttpOnly: el JavaScript no lo ve.
 */
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/lib/trpc/router-type';

export function createBrowserCaller(organizationId: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? ''}/api/v1/trpc`,
        headers: () => ({ 'x-organization-id': organizationId }),
        fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
      }),
    ],
  });
}
