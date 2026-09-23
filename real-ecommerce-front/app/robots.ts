// app/robots.ts — regla global. Cada tienda controla su indexabilidad por
// idioma vía `robots` en generateMetadata (lib/seo/site.ts → robotsFor).
import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/seo/site'

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
