// app/robots.ts — solo la landing pública es indexable; el resto (cuenta, ajustes, invitaciones) es privado.
import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/[/]+$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/$', disallow: ['/profile', '/settings', '/dashboard', '/invite', '/auth', '/api/'] },
    ...(SITE_URL ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  }
}
