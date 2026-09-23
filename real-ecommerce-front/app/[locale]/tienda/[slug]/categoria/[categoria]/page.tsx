// app/[locale]/tienda/[slug]/categoria/[categoria]/page.tsx
//
// FIX (2026-09-22): esta página no tenía generateMetadata propio, así que
// heredaba el canonical del layout padre (que apunta a /tienda/{slug}, la
// home). Resultado: Google veía cada categoría como "duplicado de la home"
// y la sacaba del índice. Cada página indexable necesita su propio canonical
// self-referencial (ADR-016 D4).
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProducts, getCategoryByHandle } from '@/lib/store'
import { toProductView, formatPrice } from '@/lib/catalog/product-view'
import { useStore } from '@/app/[locale]/tienda/[slug]/store-provider'
import { getDictionary, intlLocale, isLocale } from '@/lib/i18n'
import { indexableLocalesForStore } from '@/lib/seo/indexing'
import { buildAlternates, robotsFor } from '@/lib/seo/site'
import { breadcrumbJsonLd } from '@/lib/seo/json-ld'
import { JsonLd } from '@/components/seo/json-ld'
import { ProductCard } from '@/components/storefront/product-card'

interface Props {
  params: Promise<{ locale: string; slug: string; categoria: string }>
}

async function loadCategory(params: Props['params']) {
  const { locale: localeRaw, slug, categoria } = await params
  if (!isLocale(localeRaw)) notFound()
  const store = useStore()

  const category = await getCategoryByHandle(store.organizationId, categoria)
  if (!category) notFound()

  const rawProducts = await getProducts(store.organizationId, categoria)
  return { locale: localeRaw, slug, store, category, products: rawProducts.map(toProductView) }
}

export default async function CategoriaPage({ params }: Props) {
  const { locale, slug, store, category, products } = await loadCategory(params)
  const dict = getDictionary(locale)
  const intlTag = intlLocale(locale, store.countryCode)
  const storeName = store.name ?? slug
  const path = `/${locale}/tienda/${slug}/categoria/${category.handle}`

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/${locale}/tienda/${slug}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {dict.catalog.back}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">{category.name}</h1>
      </div>

      {products.length === 0 ? (
        <p className="text-center py-16 text-muted-foreground">{dict.catalog.emptyCategory}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              href={`/${locale}/tienda/${slug}/productos/${p.handle}`}
              product={p}
              priceLabel={p.currency && p.minPriceCents !== null ? formatPrice(p.minPriceCents, p.currency, intlTag) : null}
              noImageLabel={dict.catalog.noImage}
            />
          ))}
        </div>
      )}

      <JsonLd
        data={breadcrumbJsonLd([
          { name: dict.nav.home, url: `/${locale}/tienda/${slug}` },
          { name: category.name, url: path },
        ])}
      />
    </div>
  )
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug, store, category } = await loadCategory(params)
  const indexable = indexableLocalesForStore(store)

  return {
    title: category.name,
    alternates: buildAlternates({
      path: `/tienda/${slug}/categoria/${category.handle}`,
      currentLocale: locale,
      indexableLocales: indexable,
    }),
    robots: robotsFor(locale, indexable),
  }
}
