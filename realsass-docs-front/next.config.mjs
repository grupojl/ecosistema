// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Los Dockerfiles copian .next/standalone (imagen mínima), igual que los otros fronts.
  output: 'standalone',
  transpilePackages: ['@real/ui'],
  poweredByHeader: false,

  // Solo las URLs SIN idioma redirigen (307). Una URL con idioma nunca redirige (ADR-016).
  async redirects() {
    return [
      { source: '/', destination: '/es/docs', permanent: false },
      { source: '/docs', destination: '/es/docs', permanent: false },
      { source: '/docs/:path*', destination: '/es/docs/:path*', permanent: false },
    ]
  },

  async headers() {
    // Las docs no usan Firebase ni llaman a ningún backend desde el navegador:
    // el contenido llega renderizado por el servidor, así que la CSP es mínima.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig
