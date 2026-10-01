/**
 * app/dashboard/tienda/pedidos/page.tsx — realsass-dashboard-front
 *
 * Server Component con HydrationBoundary + prefetch real de órdenes.
 * S4-D — HydrationBoundary / Fase 4 Escalón 11
 */
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { cookies }      from 'next/headers';
import { PedidosView }  from '@/app/dashboard/tienda/pedidos/pedidos-view';
import { createDashboardCaller } from '@/lib/trpc/server';

export default async function PedidosPage() {
  const queryClient    = new QueryClient();
  const cookieStore    = await cookies();
  const sessionCookie  = cookieStore.get('__session')?.value;
  const organizationId = cookieStore.get('x-organization-id')?.value ?? '';

  if (organizationId) {
    const caller = createDashboardCaller(organizationId, sessionCookie);
    await queryClient.prefetchQuery({
      queryKey: ['store', 'orders', organizationId, {}],
      queryFn:  () => caller.adminOrders.list(),
    }).catch(() => {
      // Prefetch falla silenciosamente — el Client Component fetcha en mount
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PedidosView />
    </HydrationBoundary>
  );
}
