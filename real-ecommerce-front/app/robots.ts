// app/robots.ts — regla global. Cada tienda controla su indexabilidad por
// idioma vía `robots` en generateMetadata (lib/seo/site.ts → robotsFor).
import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/seo/site'

// SITE_URL es de runtime: sin esto Next prerenderiza robots.txt en el build y, si la variable
// no está en ese momento, el sitemap queda fuera para siempre.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/checkout', '/tracking', '/api/'],
    },
    ...(site ? { sitemap: `${site.origin}/sitemaps` } : {}),
  }
}
