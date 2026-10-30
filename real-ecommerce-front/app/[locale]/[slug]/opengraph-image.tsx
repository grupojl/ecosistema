// Imagen Open Graph de cada tienda (y de todas sus páginas): nombre de la tienda sobre un fondo de marca.
// Sin esto, compartir un link no mostraba imagen alguna (los productos todavía no tienen fotos, DT-SEO-09). Si la tienda
// tiene logo, se muestra; la foto del producto, cuando exista, la agrega cada página con su propio `openGraph.images`.
import { ImageResponse } from 'next/og'
import { resolveStore } from '@/lib/store'

export const alt = 'Tienda'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const MAX_NAME = 70

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params
  // La imagen nunca debe romper la página: ante cualquier falla se usa el slug como nombre.
  const store = await resolveStore(slug).catch(() => null)
  const raw = store?.name ?? slug
  const name = raw.length > MAX_NAME ? `${raw.slice(0, MAX_NAME - 1)}…` : raw

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 36, background: 'linear-gradient(135deg, #0a0a0a 0%, #1f2937 100%)', color: '#f5f5f5', padding: 80, // ui-lint-ignore: ImageResponse (satori) no admite variables CSS
        }}
      >
        {store?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.logoUrl} alt="" width={140} height={140} style={{ borderRadius: 28, objectFit: 'cover' }} />
        )}
        <div style={{ fontSize: name.length > 34 ? 64 : 88, fontWeight: 700, textAlign: 'center', lineHeight: 1.1, display: 'flex' }}>{name}</div>
        <div style={{ width: 120, height: 8, borderRadius: 4, background: '#3b82f6', display: 'flex' }} /> {/* ui-lint-ignore: ImageResponse (satori) no admite variables CSS */}
      </div>
    ),
    size,
  )
}
