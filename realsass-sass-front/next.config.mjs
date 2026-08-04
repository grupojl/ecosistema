// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  async headers() {
    const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''

    // URLs externas leídas de variables de entorno.
    // En Railway estas vars apuntan a los dominios reales.
    // En dev apuntan a localhost (configuradas en .env.local).
    const sassBackUrl    = (process.env.NEXT_PUBLIC_SASS_BACK_URL ?? '').replace(/\/+$/, '')
    const dashFrontUrl   = (process.env.NEXT_PUBLIC_DASHBOARD_FRONT_URL ?? '').replace(/\/+$/, '')
    const apiUrl         = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '')

    // Extrae solo origin (protocolo + host) de una URL completa.
    // Ej: "https://foo.up.railway.app/api/v1" → "https://foo.up.railway.app"
    function origin(url) {
      if (!url) return ''
      try { return new URL(url).origin } catch { return url }
    }

    // Construye connect-src con todos los orígenes necesarios,
    // deduplicados y sin entradas vacías.
    const connectOrigins = [
      "'self'",
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://*.googleapis.com',
      'https://*.firebaseio.com',
      'https://*.firebase.google.com',
      'https://*.firebasestorage.googleapis.com',
      'https://*.railway.app',
      'https://*.up.railway.app',
      origin(sassBackUrl),
      origin(apiUrl),
      origin(dashFrontUrl),
    ].filter(Boolean)

    // Dedup sin Set para compatibilidad con todos los entornos de build
    const seen = {}
    const connectSrc = connectOrigins
      .filter(v => { if (seen[v]) return false; seen[v] = true; return true })
      .join(' ')

    const csp = [
      "default-src 'self'",
      [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        'https://apis.google.com',
        'https://appleid.apple.com',
        'https://connect.facebook.net',
        'https://www.facebook.com',
      ].join(' '),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      [
        "frame-src 'self'",
        'https://accounts.google.com',
        'https://appleid.apple.com',
        'https://www.facebook.com',
        'https://facebook.com',
        firebaseProject ? `https://${firebaseProject}.firebaseapp.com` : '',
        'https://*.iam.gserviceaccount.com',
      ].filter(Boolean).join(' '),
      `connect-src ${connectSrc}`,
      [
        "img-src 'self' data: blob:",
        'https://*.googleusercontent.com',
        'https://*.fbcdn.net',
        'https://*.facebook.com',
        'https://*.firebasestorage.googleapis.com',
      ].join(' '),
      "form-action 'self'",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].map(d => d.trim()).join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
    ],
  },

  poweredByHeader: false,
}

export default nextConfig
