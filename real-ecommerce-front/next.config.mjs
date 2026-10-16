/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    unoptimized: true,
  },

  // ADR-022: /{locale}/tienda/{slug}/… pasó a /{locale}/{slug}/… (308: Google transfiere el posicionamiento).
  // Las URLs viejas SIN idioma (/tienda/{slug}) las resuelve proxy.ts.
  async redirects() {
    return [
      { source: '/:locale(es|pt|en|fr|de)/tienda/:slug', destination: '/:locale/:slug', permanent: true },
      { source: '/:locale(es|pt|en|fr|de)/tienda/:slug/:path*', destination: '/:locale/:slug/:path*', permanent: true },
    ];
  },
}

export default nextConfig
