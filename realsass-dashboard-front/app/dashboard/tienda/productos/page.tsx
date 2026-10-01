/**
 * app/dashboard/tienda/productos/page.tsx — realsass-dashboard-front
 *
 * Server Component con HydrationBoundary + prefetch real.
 * El server caller obtiene los datos antes de renderizar → sin loading flash.
 *
 * S4-D — HydrationBoundary / Fase 4 Escalón 11
 */
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { cookies }        from 'next/headers';
import { ProductosView }  from '@/app/dashboard/tienda/productos/productos-view';
import { createDashboardCaller } from '@/lib/trpc/server';

export default async function ProductosPage() {
  const queryClient    = new QueryClient();
  const cookieStore    = await cookies();
  const sessionCookie  = cookieStore.get('__session')?.value;
  const organizationId = cookieStore.get('x-organization-id')?.value ?? '';

  if (organizationId) {
    const caller = createDashboardCaller(organizationId, sessionCookie);
    await queryClient.prefetchQuery({
      queryKey: ['store', 'products', organizationId, {}],
      queryFn:  () => caller.adminCatalog.list(),
    }).catch(() => {
      // Prefetch falla silenciosamente — el Client Component fetcha en mount
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductosView />
    </HydrationBoundary>
  );
}
