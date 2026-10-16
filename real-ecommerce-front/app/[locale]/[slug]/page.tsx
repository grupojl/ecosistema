// app/[locale]/[slug]/page.tsx — Homepage de la tienda
//
// Mismo lenguaje visual que la home base (secciones hero a pantalla completa, oscuro/claro alternado),
// pero con los datos REALES de la organización: marca + hasta 4 productos destacados + resto del catálogo.
import Link from 'next/link'
import { getProducts, getCategories } from '@/lib/store'
import { toProductView, formatPrice } from '@/lib/catalog/product-view'
import { requireStore } from '@/lib/store'
import { getDictionary, t, intlLocale, isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/components/storefront/product-card'
import ProductHero from '@/components/product-hero'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

const HERO_LIMIT = 4        // productos que se muestran como sección hero
const FEATURED_LIMIT = 8    // productos totales en la home (heroes + grilla)
const DESCRIPTION_MAX = 140

function shorten(text: string | null, max: number): string | undefined {
  if (!text) return undefined
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

export default async function StorePage({ params }: Props) {
  const { locale: localeRaw, slug } = await params
  if (!isLocale(localeRaw)) notFound()
  const locale = localeRaw
  const dict = getDictionary(locale)
  const store = await requireStore(slug)

  const [rawProducts, categories] = await Promise.all([
    getProducts(store.organizationId),
    getCategories(store.organizationId),
  ])

  const products = rawProducts.slice(0, FEATURED_LIMIT).map(toProductView)
  const heroes = products.slice(0, HERO_LIMIT)
  const rest = products.slice(HERO_LIMIT)
  const intlTag = intlLocale(locale, store.countryCode)
  const storeName = store.name ?? slug
  const base = `/${locale}/${slug}`

  const priceOf = (p: (typeof products)[number]) =>
    p.currency && p.minPriceCents !== null ? formatPrice(p.minPriceCents, p.currency, intlTag) : null

  return (
    <>
      {/* Marca de la tienda */}
      <ProductHero
        darkBg
        title={storeName}
        subtitle={store.description ?? t(dict.store.defaultDescription, { store: storeName })}
        primary={{ label: dict.store.heroCta, href: `${base}/productos` }}
      />

      {/* Productos destacados, alternando claro/oscuro */}
      {heroes.map((p, i) => (
        <ProductHero
          key={p.id}
          darkBg={i % 2 === 1}
          headingLevel="h2"
          title={p.name}
          subtitle={[p.category?.name, priceOf(p)].filter(Boolean).join(' · ') || storeName}
          description={shorten(p.description, DESCRIPTION_MAX)}
          noImageLabel={dict.catalog.noImage}
          primary={{ label: dict.store.learnMore, href: `${base}/productos/${p.handle}` }}
          secondary={{ label: dict.store.seeAll.replace(/\s*→\s*$/, ''), href: `${base}/productos` }}
        />
      ))}

      <div className="container mx-auto px-4 py-12 space-y-12">
        {products.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>{dict.store.empty}</p>
            <p className="text-sm mt-2">{dict.store.emptyHint}</p>
          </div>
        )}

        {categories.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">{dict.store.categories}</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`${base}/categoria/${cat.handle}`}
                  className="px-4 py-2 border border-border rounded-full text-sm hover:bg-accent transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">{dict.store.products}</h2>
              <Link href={`${base}/productos`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {dict.store.seeAll}
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {rest.map((p) => (
                <ProductCard
                  key={p.id}
                  href={`${base}/productos/${p.handle}`}
                  product={p}
                  priceLabel={priceOf(p)}
                  noImageLabel={dict.catalog.noImage}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
