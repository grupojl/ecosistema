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
      // Solo en producción: los archivos llevan hash en el nombre. En desarrollo no, y `immutable` por un
      // año hace que el navegador se quede con JavaScript viejo (y Next avisa que rompe el dev).
      ...(process.env.NODE_ENV === 'production'
        ? [{
            source: '/_next/static/:path*',
            headers: [
              { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
            ],
          }]
        : []),
    ];
  },
}
export default nextConfig
