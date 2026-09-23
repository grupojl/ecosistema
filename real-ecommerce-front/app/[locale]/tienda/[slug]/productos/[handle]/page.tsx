// app/[locale]/tienda/[slug]/productos/[handle]/page.tsx — Detalle de producto
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProductByHandle } from '@/lib/store'
import { toProductView, formatPrice } from '@/lib/catalog/product-view'
import { useStore } from '@/app/[locale]/tienda/[slug]/store-provider'
import { getDictionary, t, intlLocale, isLocale } from '@/lib/i18n'
import { indexableLocalesForStore } from '@/lib/seo/indexing'
import { buildAlternates, robotsFor, getSiteUrl, absoluteUrl, localizedPath } from '@/lib/seo/site'
import { productJsonLd, breadcrumbJsonLd } from '@/lib/seo/json-ld'
import { JsonLd } from '@/components/seo/json-ld'

interface Props {
  params: Promise<{ locale: string; slug: string; handle: string }>
}

async function loadProduct(params: Props['params']) {
  const { locale: localeRaw, slug, handle } = await params
  if (!isLocale(localeRaw)) notFound()
  const store = useStore()

  const raw = await getProductByHandle(store.organizationId, handle)
  if (!raw) notFound()

  return { locale: localeRaw, slug, store, product: toProductView(raw) }
}

export default async function ProductoPage({ params }: Props) {
  const { locale, slug, store, product } = await loadProduct(params)
  const dict = getDictionary(locale)
  const intlTag = intlLocale(locale, store.countryCode)
  const storeName = store.name ?? slug
  const path = `/${locale}/tienda/${slug}/productos/${product.handle}`

  const price =
    product.currency && product.minPriceCents !== null
      ? product.minPriceCents === product.maxPriceCents
        ? formatPrice(product.minPriceCents, product.currency, intlTag)
        : t(dict.product.fromPrice, { price: formatPrice(product.minPriceCents, product.currency, intlTag) })
      : null

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/${locale}/tienda/${slug}/productos`} className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block">
        {dict.product.backToProducts}
      </Link>

      <div className="grid md:grid-cols-2 gap-10 mt-4">
        <div className="aspect-square bg-muted rounded-xl overflow-hidden flex items-center justify-center">
          <span className="text-muted-foreground" aria-hidden="true">{dict.catalog.noImage}</span>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            {price && <p className="text-3xl font-semibold mt-2">{price}</p>}
          </div>

          {product.description && (
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          {product.variants.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{dict.product.variants}</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <span
                    key={v.id}
                    className={`px-3 py-1 border rounded-lg text-sm ${
                      v.available
                        ? 'border-border hover:bg-accent cursor-pointer'
                        : 'border-muted text-muted-foreground line-through cursor-not-allowed'
                    }`}
                  >
                    {v.title}
                    {!v.available && ` ${dict.product.outOfStock}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">{dict.product.contactToBuy}</p>
            {store.website && (
              <a
                href={store.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                {t(dict.product.goToSite, { store: storeName })}
              </a>
            )}
          </div>
        </div>
      </div>

      <JsonLd
        data={[
          productJsonLd({ product, url: path, storeName, inLanguage: locale }),
          breadcrumbJsonLd([
            { name: dict.nav.home, url: `/${locale}/tienda/${slug}` },
            { name: dict.nav.products, url: `/${locale}/tienda/${slug}/productos` },
            { name: product.name, url: path },
          ]),
        ]}
      />
    </div>
  )
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug, store, product } = await loadProduct(params)
  const indexable = indexableLocalesForStore(store)
  const site = getSiteUrl()

  return {
    title: product.name,
    description: product.description ?? undefined,
    alternates: buildAlternates({
      path: `/tienda/${slug}/productos/${product.handle}`,
      currentLocale: locale,
      indexableLocales: indexable,
    }),
    robots: robotsFor(locale, indexable),
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      locale: `${locale}_${store.countryCode}`,
      url: site ? absoluteUrl(site, localizedPath(locale, `/tienda/${slug}/productos/${product.handle}`)) : undefined,
      type: 'website',
    },
  }
}
