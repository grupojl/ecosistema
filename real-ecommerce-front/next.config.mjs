/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    unoptimized: true,
  },

  poweredByHeader: false,

  // Cabeceras de seguridad. La CSP es el subconjunto que NO restringe scripts/estilos (el storefront
  // embebe JSON-LD y Next inyecta inline); falta una CSP completa con nonces (DT-Q-08).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
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
