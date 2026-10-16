// app/sitemap.ts — una sola URL pública: la landing.
import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/[/]+$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_URL ? [{ url: `${SITE_URL}/` }] : []
}
