/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  // El panel vive en la raíz (antes /dashboard/...). Las URLs viejas siguen funcionando.
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/dashboard/:path*', destination: '/:path*', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      // /_next/static ya se sirve con `public, max-age=31536000, immutable` por defecto en producción (Next).
      // No se redefine acá: un Cache-Control propio sobre esa ruta hace que Next avise que rompe el dev.
    ];
  },
}
export default nextConfig
