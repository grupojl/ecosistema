// app/tienda/[slug]/page.tsx — Homepage de la tienda
import { resolveStore, getProducts, getCategories } from '@/lib/store'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params
  const store = await resolveStore(slug)
  if (!store) notFound()

  const [productsResult, categories] = await Promise.all([
    getProducts(store.organizationId, { limit: 8 }),
    getCategories(store.organizationId),
  ])

  const products = Array.isArray(productsResult)
    ? productsResult
    : productsResult.items

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl font-bold tracking-tight">
          {store.name ?? slug}
        </h1>
        {store.description && (
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {store.description}
          </p>
        )}
        <Link
          href={`/tienda/${slug}/productos`}
          className="inline-block mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Ver todos los productos
        </Link>
      </section>

      {/* Categorías */}
      {categories.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Categorías</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/tienda/${slug}/categoria/${cat.handle}`}
                className="px-4 py-2 border border-border rounded-full text-sm hover:bg-accent transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Productos destacados */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Productos</h2>
          <Link
            href={`/tienda/${slug}/productos`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todos →
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Esta tienda aún no tiene productos cargados.</p>
            <p className="text-sm mt-2">El administrador puede agregarlos desde el dashboard.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/tienda/${slug}/productos/${p.slug || p.id}`}
                className="group border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {p.imageUrls?.[0] ? (
                    <img
                      src={p.imageUrls[0]}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">Sin imagen</span>
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
      </section>
    </div>
  )
}
