// realsass-dashboard-front/app/dashboard/tienda/pedidos/page.tsx
// Server Component — HydrationBoundary (ADR-009/S4-D).
// ECO-FRONT-02: aplica el patrón Server/Client correcto.
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { PedidosView } from './pedidos-view';

export default async function PedidosPage() {
  const queryClient = new QueryClient();
  // TODO S5: prefetchQuery con adminOrders.list cuando el server caller esté disponible.
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PedidosView />
    </HydrationBoundary>
  );
}
