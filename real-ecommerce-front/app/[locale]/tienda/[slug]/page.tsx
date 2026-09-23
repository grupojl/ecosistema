// app/[locale]/tienda/[slug]/page.tsx — Homepage de la tienda
import Link from 'next/link'
import { getProducts, getCategories } from '@/lib/store'
import { toProductView, formatPrice } from '@/lib/catalog/product-view'
import { useStore } from '@/app/[locale]/tienda/[slug]/store-provider'
import { getDictionary, t, intlLocale, isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/components/storefront/product-card'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

const FEATURED_LIMIT = 8

export default async function StorePage({ params }: Props) {
  const { locale: localeRaw, slug } = await params
  if (!isLocale(localeRaw)) notFound()
  const locale = localeRaw
  const dict = getDictionary(locale)
  const store = useStore()

  const [rawProducts, categories] = await Promise.all([
    getProducts(store.organizationId),
    getCategories(store.organizationId),
  ])

  const products = rawProducts.slice(0, FEATURED_LIMIT).map(toProductView)
  const intlTag = intlLocale(locale, store.countryCode)
  const storeName = store.name ?? slug

  return (
    <div className="space-y-12">
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl font-bold tracking-tight">{storeName}</h1>
        {store.description && (
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">{store.description}</p>
        )}
        <Link
          href={`/${locale}/tienda/${slug}/productos`}
          className="inline-block mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          {dict.store.heroCta}
        </Link>
      </section>

      {categories.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">{dict.store.categories}</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/${locale}/tienda/${slug}/categoria/${cat.handle}`}
                className="px-4 py-2 border border-border rounded-full text-sm hover:bg-accent transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{dict.store.products}</h2>
          <Link href={`/${locale}/tienda/${slug}/productos`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {dict.store.seeAll}
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>{dict.store.empty}</p>
            <p className="text-sm mt-2">{dict.store.emptyHint}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                href={`/${locale}/tienda/${slug}/productos/${p.handle}`}
                product={p}
                priceLabel={
                  p.currency && p.minPriceCents !== null
                    ? formatPrice(p.minPriceCents, p.currency, intlTag)
                    : null
                }
                noImageLabel={dict.catalog.noImage}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
