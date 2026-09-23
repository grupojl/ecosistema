// app/sitemaps/[slug]/route.ts — sitemap por tienda.
// GET /sitemaps/{slug} → solo URLs indexables (D8, ADR-016).
//
// FIX (narrowing): `site` es `URL | null`. TypeScript no propaga el
// narrowing de una const capturada por closure dentro de una función
// anidada definida más abajo en el mismo scope — hay que pasarla como
// parámetro explícito para que el tipo `URL` (no `URL | null`) llegue
// intacto a absoluteUrl().
import { NextResponse } from 'next/server'
import { resolveStore } from '@/lib/store'
import { getProducts, getCategories } from '@/lib/store'
import { indexableLocalesForStore } from '@/lib/seo/indexing'
import { getSiteUrl, absoluteUrl, localizedPath } from '@/lib/seo/site'
import { buildSitemapXml, type SitemapEntry } from '@/lib/seo/sitemap'
import { toProductView } from '@/lib/catalog/product-view'
import type { Locale } from '@/lib/i18n'

interface RouteParams {
  params: Promise<{ slug: string }>
}

function alternatesFor(site: URL, indexable: readonly Locale[], path: string) {
  return indexable.map((locale) => ({
    hreflang: locale,
    href: absoluteUrl(site, localizedPath(locale, path)),
  }))
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params
  const site = getSiteUrl()
  if (!site) {
    return new NextResponse('SITE_URL no configurado', { status: 503 })
  }

  const store = await resolveStore(slug)
  if (!store) {
    return new NextResponse('Tienda no encontrada', { status: 404 })
  }

  const indexable = indexableLocalesForStore(store)
  const [products, categories] = await Promise.all([
    getProducts(store.organizationId).then((list) => list.map(toProductView)),
    getCategories(store.organizationId),
  ])

  const entries: SitemapEntry[] = [
    {
      loc: absoluteUrl(site, localizedPath(indexable[0], `/tienda/${slug}`)),
      alternates: alternatesFor(site, indexable, `/tienda/${slug}`),
    },
    {
      loc: absoluteUrl(site, localizedPath(indexable[0], `/tienda/${slug}/productos`)),
      alternates: alternatesFor(site, indexable, `/tienda/${slug}/productos`),
    },
    ...categories.map((c) => ({
      loc:        absoluteUrl(site, localizedPath(indexable[0], `/tienda/${slug}/categoria/${c.handle}`)),
      alternates: alternatesFor(site, indexable, `/tienda/${slug}/categoria/${c.handle}`),
    })),
    ...products.map((p) => ({
      loc:        absoluteUrl(site, localizedPath(indexable[0], `/tienda/${slug}/productos/${p.handle}`)),
      lastmod:    p.updatedAt,
      alternates: alternatesFor(site, indexable, `/tienda/${slug}/productos/${p.handle}`),
    })),
  ]

  return new NextResponse(buildSitemapXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
