// app/[locale]/[slug]/productos/page.tsx — Listado paginado

// ISR: catálogo de productos revalida cada 30 min (stock puede cambiar más seguido)
export const revalidate = 1800;
import { PageContainer, PageHeader } from '@real/ui'
import Link from 'next/link'
import { Button } from '@real/ui'
import { notFound } from 'next/navigation'
import { getProducts } from '@/lib/store'
import { toProductView, formatPrice, paginate, parsePageParam } from '@/lib/catalog/product-view'
import { requireStore } from '@/lib/store'
import { getDictionary, t, plural, intlLocale, isLocale } from '@/lib/i18n'
import { indexableLocalesForStore } from '@/lib/seo/indexing'
import { buildAlternates, robotsFor } from '@/lib/seo/site'
import { ProductCard } from '@/components/storefront/product-card'

const PAGE_SIZE = 20

interface Props {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ page?: string }>
}

async function loadPage(params: Props['params'], searchParams: Props['searchParams']) {
  const { locale: localeRaw, slug } = await params
  const { page: pageStr } = await searchParams
  if (!isLocale(localeRaw)) notFound()
  const page = parsePageParam(pageStr)
  const store = await requireStore(slug)

  const rawProducts = await getProducts(store.organizationId)
  const views = rawProducts.map(toProductView)
  const paged = paginate(views, page, PAGE_SIZE)
  if (!paged) notFound() // page fuera de rango → 404 real, no soft-404

  return { locale: localeRaw, slug, store, paged }
}

export default async function ProductosPage({ params, searchParams }: Props) {
  const { locale, slug, store, paged } = await loadPage(params, searchParams)
  const dict = getDictionary(locale)
  const intlTag = intlLocale(locale, store.countryCode)

  return (
    <PageContainer size="xl" className="space-y-8">
      <PageHeader title={dict.catalog.allProducts} description={plural(locale, paged.total, dict.catalog.productCount)} />

      {paged.items.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground"><p>{dict.catalog.empty}</p></div>
      ) : (
        <div className="grid medium:grid-cols-2 expanded:grid-cols-4 gap-6">
          {paged.items.map((p) => (
            <ProductCard
              key={p.id}
              href={`/${locale}/${slug}/productos/${p.handle}`}
              product={p}
              priceLabel={p.currency && p.minPriceCents !== null ? formatPrice(p.minPriceCents, p.currency, intlTag) : null}
              noImageLabel={dict.catalog.noImage}
            />
          ))}
        </div>
      )}

      {paged.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {paged.page > 1 && (
            <Button asChild variant="outline" size="sm"><Link href={`/${locale}/${slug}/productos?page=${paged.page - 1}`}>
              {dict.catalog.previous}
            </Link></Button>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            {t(dict.catalog.pageOf, { page: paged.page, total: paged.totalPages })}
          </span>
          {paged.page < paged.totalPages && (
            <Button asChild variant="outline" size="sm"><Link href={`/${locale}/${slug}/productos?page=${paged.page + 1}`}>
              {dict.catalog.next}
            </Link></Button>
          )}
        </div>
      )}
    </PageContainer>
  )
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, slug, store, paged } = await loadPage(params, searchParams)
  const dict = getDictionary(locale)
  const indexable = indexableLocalesForStore(store)
  const path = `/${slug}/productos${paged.page > 1 ? `?page=${paged.page}` : ''}`

  return {
    title: paged.page > 1 ? t(dict.catalog.pageTitle, { page: paged.page }) : dict.catalog.allProducts,
    description: t(dict.catalog.metaDescription, { store: store.name ?? slug }),
    alternates: buildAlternates({ path, currentLocale: locale, indexableLocales: indexable }),
    // Páginas 2+ no compiten por posicionamiento propio — solo la página 1 se indexa.
    robots: paged.page > 1 ? { index: false, follow: true } : robotsFor(locale, indexable),
  }
}
