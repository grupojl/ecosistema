#!/usr/bin/env bash
set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok() { echo -e "${GREEN}✓${NC} $1"; }

ROOT="realsass-dashboard-front"
[ -d "$ROOT" ] || { echo "No se encontró $ROOT/"; exit 1; }

cat > "$ROOT/next.config.mjs" << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  async headers() {
    const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''

    return [
      {
        // COOP: permite que el popup de Google Auth funcione sin ser bloqueado
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
      {
        // Cache para assets estáticos
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig
EOF

ok "next.config.mjs actualizado — COOP same-origin-allow-popups agregado"