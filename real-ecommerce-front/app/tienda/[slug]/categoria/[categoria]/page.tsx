// app/tienda/[slug]/categoria/[categoria]/page.tsx
import { resolveStore, getProducts, getCategoryByHandle } from '@/lib/store'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string; categoria: string }>
}

export default async function CategoriaPage({ params }: Props) {
  const { slug, categoria } = await params

  const store = await resolveStore(slug)
  if (!store) notFound()

  const [category, result] = await Promise.all([
    getCategoryByHandle(store.organizationId, categoria),
    getProducts(store.organizationId, { category: categoria }),
  ])

  if (!category) notFound()

  const products = Array.isArray(result) ? result : result.items

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/tienda/${slug}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground mt-1">{category.description}</p>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-center py-16 text-muted-foreground">
          No hay productos en esta categoría.
        </p>
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
    </div>
  )
}
