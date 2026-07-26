// app/tienda/[slug]/productos/page.tsx — Listado completo de productos
import { resolveStore, getProducts } from '@/lib/store'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function ProductosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { page: pageStr } = await searchParams
  const page = Number(pageStr) || 1

  const store = await resolveStore(slug)
  if (!store) notFound()

  const result = await getProducts(store.organizationId, { page, limit: 20 })
  const products = Array.isArray(result) ? result : result.items
  const meta = Array.isArray(result) ? null : result.meta

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Todos los productos</h1>
        {meta && (
          <p className="text-sm text-muted-foreground mt-1">
            {meta.total} producto{meta.total !== 1 ? 's' : ''} disponible{meta.total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <p>No hay productos disponibles todavía.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/tienda/${slug}/productos/${p.slug || p.id}`}
              className="group border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-muted overflow-hidden">
                {p.imageUrls?.[0] ? (
                  <img
                    src={p.imageUrls[0]}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    Sin imagen
                  </div>
                )}
              </div>
              <div className="p-4 space-y-1">
                <p className="font-medium text-sm line-clamp-2">{p.name}</p>
                <p className="text-muted-foreground text-sm">
                  {new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: p.currency || 'ARS',
                  }).format(p.priceCents / 100)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Paginación simple */}
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {page > 1 && (
            <Link
              href={`/tienda/${slug}/productos?page=${page - 1}`}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
            >
              ← Anterior
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            {page} / {meta.totalPages}
          </span>
          {page < meta.totalPages && (
            <Link
              href={`/tienda/${slug}/productos?page=${page + 1}`}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
