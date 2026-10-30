// app/[locale]/[slug]/productos/[handle]/page.tsx — Detalle de producto
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProductByHandle } from '@/lib/store'
import { toProductView, formatPrice } from '@/lib/catalog/product-view'
import { requireStore } from '@/lib/store'
import { getDictionary, t, intlLocale, isLocale } from '@/lib/i18n'
import { indexableLocalesForStore } from '@/lib/seo/indexing'
import { buildAlternates, robotsFor, getSiteUrl, absoluteUrl, localizedPath } from '@/lib/seo/site'
import { productJsonLd, breadcrumbJsonLd } from '@/lib/seo/json-ld'
import { JsonLd } from '@/components/seo/json-ld'
import { AddToCart } from '@/components/commerce/add-to-cart'
import { Breadcrumb, PageHeader } from '@real/ui'

interface Props {
  params: Promise<{ locale: string; slug: string; handle: string }>
}

async function loadProduct(params: Props['params']) {
  const { locale: localeRaw, slug, handle } = await params
  if (!isLocale(localeRaw)) notFound()
  const store = await requireStore(slug)

  const raw = await getProductByHandle(store.organizationId, handle)
  if (!raw) notFound()

  return { locale: localeRaw, slug, store, product: toProductView(raw) }
}

export default async function ProductoPage({ params }: Props) {
  const { locale, slug, store, product } = await loadProduct(params)
  const dict = getDictionary(locale)
  const intlTag = intlLocale(locale, store.countryCode)
  const storeName = store.name ?? slug
  const path = `/${locale}/${slug}/productos/${product.handle}`

  const price =
    product.currency && product.minPriceCents !== null
      ? product.minPriceCents === product.maxPriceCents
        ? formatPrice(product.minPriceCents, product.currency, intlTag)
        : t(dict.product.fromPrice, { price: formatPrice(product.minPriceCents, product.currency, intlTag) })
      : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb
        linkAs={Link}
        className="mb-6"
        items={[
          { label: storeName, href: `/${locale}/${slug}` },
          { label: dict.nav.products, href: `/${locale}/${slug}/productos` },
          { label: product.name },
        ]}
      />

      <div className="grid medium:grid-cols-2 gap-10 mt-4">
        <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
          <span className="text-muted-foreground" aria-hidden="true">{dict.catalog.noImage}</span>
        </div>

        <div className="space-y-6">
          <div>
            <PageHeader title={product.name} />
            {price && <p className="text-3xl font-semibold mt-2">{price}</p>}
          </div>

          {product.description && (
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          <AddToCart variants={product.variants} currency={product.currency} />

          {store.website && (
            <div className="pt-4 border-t border-border">
              <a
                href={store.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground underline hover:text-foreground transition-colors"
              >
                {t(dict.product.goToSite, { store: storeName })}
              </a>
            </div>
          )}
        </div>
      </div>

      <JsonLd
        data={[
          productJsonLd({ product, url: path, storeName, inLanguage: locale }),
          breadcrumbJsonLd([
            { name: dict.nav.home, url: `/${locale}/${slug}` },
            { name: dict.nav.products, url: `/${locale}/${slug}/productos` },
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
      path: `/${slug}/productos/${product.handle}`,
      currentLocale: locale,
      indexableLocales: indexable,
    }),
    robots: robotsFor(locale, indexable),
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      locale: `${locale}_${store.countryCode}`,
      url: site ? absoluteUrl(site, localizedPath(locale, `/${slug}/productos/${product.handle}`)) : undefined,
      type: 'website',
    },
  }
}
