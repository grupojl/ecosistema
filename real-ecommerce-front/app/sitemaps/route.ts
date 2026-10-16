// app/sitemaps/route.ts — índice de sitemaps: un <sitemap> por tienda activa.
// robots.txt anuncia `Sitemap: {SITE_URL}/sitemaps`; antes esa URL daba 404 y Google no descubría ningún sitemap.
//
// 5xx ante cualquier falla (nunca un índice vacío): Google conserva lo que ya tiene indexado.
import { NextResponse } from 'next/server'
import { createStoreCaller } from '@/lib/trpc/server'
import { getSiteUrl, absoluteUrl } from '@/lib/seo/site'
import { buildSitemapIndexXml } from '@/lib/seo/sitemap'

// SITE_URL es de runtime (igual que robots.ts); el CDN cachea por el header.
export const dynamic = 'force-dynamic'

export async function GET() {
  const site = getSiteUrl()
  if (!site) return new NextResponse('SITE_URL no configurado', { status: 503 })

  try {
    const stores = await createStoreCaller().customer.listStores.query()
    const xml = buildSitemapIndexXml(
      stores.map((s) => ({ loc: absoluteUrl(site, `/sitemaps/${s.slug}`), lastmod: new Date(s.updatedAt) })),
    )
    return new NextResponse(xml, {
      headers: {
        'Content-Type':  'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse('Listado de tiendas no disponible', { status: 503, headers: { 'Retry-After': '300' } })
  }
}
