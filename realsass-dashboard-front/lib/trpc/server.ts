/**
 * lib/trpc/server.ts — realsass-dashboard-front
 *
 * tRPC server caller para Server Components (RSC).
 * Permite prefetchear datos en el servidor antes de renderizar
 * y pasarlos al client via HydrationBoundary — sin loading flash.
 *
 * Uso en page.tsx (Server Component):
 *   import { createDashboardCaller } from '@/lib/trpc/server';
 *   import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
 *
 *   export default async function EntesPage() {
 *     const queryClient = new QueryClient();
 *     const caller = createDashboardCaller(organizationId);
 *     await queryClient.prefetchQuery({
 *       queryKey: [['organigrama', 'list'], { type: 'query' }],
 *       queryFn: () => caller.organigrama.list.query(),
 *     });
 *     return (
 *       <HydrationBoundary state={dehydrate(queryClient)}>
 *         <EntesView />
 *       </HydrationBoundary>
 *     );
 *   }
 *
 * IMPORTANTE: el organizationId viene de las cookies del request.
 * En Server Components se puede leer con `cookies()` de next/headers.
 *
 * S4-D — HydrationBoundary / Fase 4 Escalón 11
 */
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { SassAppRouter }              from '@real/trpc';

function getSassBackUrl(): string {
  // En server-side usamos la URL interna (sin NEXT_PUBLIC_)
  const url = process.env['SASS_BACK_URL']
    ?? process.env['NEXT_PUBLIC_SASS_BACK_URL']
    ?? process.env['NEXT_PUBLIC_REAL_BACK_URL'];
  if (!url) throw new Error('[trpc/server] SASS_BACK_URL no está configurado');
  return url.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
}

/**
 * Crea un server caller de tRPC para el dashboard de colaboradores.
 * Se instancia por request — no cachear entre requests.
 *
 * @param organizationId — ID de la organización activa del usuario
 * @param sessionCookie  — cookie __session para autenticación (opcional en prefetch)
 */
export function createDashboardCaller(
  organizationId: string,
  sessionCookie?: string,
) {
  return createTRPCClient<SassAppRouter>({
    links: [
      httpBatchLink({
        url: `${getSassBackUrl()}/api/v1/trpc`,
        headers() {
          return {
            'x-organization-id': organizationId,
            ...(sessionCookie ? { cookie: `__session=${sessionCookie}` } : {}),
          };
        },
      }),
    ],
  });
}
