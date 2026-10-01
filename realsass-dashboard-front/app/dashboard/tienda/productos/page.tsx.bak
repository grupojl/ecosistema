// realsass-dashboard-front/app/dashboard/tienda/productos/page.tsx
// Server Component — prefetch de productos + HydrationBoundary (ADR-009/S4-D).
// ECO-FRONT-01: aplica el patrón Server/Client correcto.
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { ProductosView } from '@/app/dashboard/tienda/productos/productos-view';

export default async function ProductosPage() {
  const queryClient = new QueryClient();

  // El prefetch se conecta al router tRPC server-side cuando esté disponible.
  // Por ahora el QueryClient se pasa vacío y el Client Component fetcha en mount.
  // TODO S5: agregar prefetchQuery con createServerCaller() cuando el procedure
  //          adminCatalog.list esté disponible en el server caller.

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductosView />
    </HydrationBoundary>
  );
}
