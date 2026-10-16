// app/robots.ts — el dashboard es una aplicación privada: no se indexa nada.
// (Cada página además sale con <meta name="robots" content="noindex">, ver layout.tsx.)
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}
