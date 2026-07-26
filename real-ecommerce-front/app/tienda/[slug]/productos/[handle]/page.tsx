// app/tienda/[slug]/productos/[handle]/page.tsx — Detalle de producto
import { resolveStore, getProductByHandle } from '@/lib/store'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string; handle: string }>
}

export default async function ProductoPage({ params }: Props) {
  const { slug, handle } = await params

  const store = await resolveStore(slug)
  if (!store) notFound()

  const product = await getProductByHandle(store.organizationId, handle)
  if (!product) notFound()

  const price = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: product.currency || 'ARS',
  }).format(product.priceCents / 100)

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/tienda/${slug}/productos`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block"
      >
        ← Volver a productos
      </Link>

      <div className="grid md:grid-cols-2 gap-10 mt-4">
        {/* Imagen */}
        <div className="aspect-square bg-muted rounded-xl overflow-hidden">
          {product.imageUrls?.[0] ? (
            <img
              src={product.imageUrls[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Sin imagen
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-3xl font-semibold mt-2">{price}</p>
          </div>

          {product.description && (
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          {/* Variantes */}
          {product.variants && product.variants.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Variantes disponibles</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <span
                    key={v.id}
                    className={`px-3 py-1 border rounded-lg text-sm ${
                      v.stock > 0
                        ? 'border-border hover:bg-accent cursor-pointer'
                        : 'border-muted text-muted-foreground line-through cursor-not-allowed'
                    }`}
                  >
                    {v.name}
                    {v.stock === 0 && ' (sin stock)'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CTA — sin pagos por ahora */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Para realizar una compra, contactá directamente a la tienda.
            </p>
            {store.website && (
              <a
                href={store.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Ir al sitio de {store.name ?? slug}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: Props) {
  const { slug, handle } = await params
  const store = await resolveStore(slug)
  if (!store) return {}

  const product = await getProductByHandle(store.organizationId, handle)
  return {
    title: product ? `${product.name} — ${store.name ?? slug}` : 'Producto',
    description: product?.description ?? undefined,
  }
}
