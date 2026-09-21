'use client';
// real-ecommerce-front/app/tienda/[slug]/productos/productos-view.tsx
// Client Component — catálogo de productos del storefront.
// ECO-FRONT-04: rehidrata datos prefetcheados por la page.tsx Server Component.
import { trpc } from '@/lib/trpc/client';

interface ProductosViewProps {
  organizationId: string;
  category?:      string;
}

export function ProductosView({ organizationId, category }: ProductosViewProps) {
  const { data: products, isLoading, error } = trpc.customer.getProducts.useQuery({
    organizationId,
    category,
  });

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-64 bg-muted rounded-lg" />
      ))}
    </div>
  );

  if (error) return (
    <div className="text-center py-12 text-muted-foreground">
      No se pudieron cargar los productos
    </div>
  );

  if (!products?.length) return (
    <div className="text-center py-12 text-muted-foreground">
      No hay productos disponibles
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map(product => (
        <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
          <h3 className="font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{product.status}</p>
        </div>
      ))}
    </div>
  );
}
