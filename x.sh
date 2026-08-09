#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 9: dashboard-front app/layout.tsx
# Agrega initFirebase y sassBackUrl al AuthProvider
# =============================================================================

set -euo pipefail
[ -f "pnpm-workspace.yaml" ] || { echo "Corre desde la raiz"; exit 1; }

BOLD='\033[1m'; GREEN='\033[0;32m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
sep() { echo -e "${BOLD}----------------------------------------------------${NC}"; }

sep
echo -e "${BOLD}  FIX 9 — dashboard-front layout.tsx${NC}"
sep

cat > realsass-dashboard-front/app/layout.tsx << 'EOF'
import '@/lib/firebase'
import { TrpcProvider }  from '@/lib/trpc/provider'
import type { Metadata } from 'next'
import { Inter }         from 'next/font/google'
import { Toaster }       from 'sonner'
import { QueryProvider } from '@/providers/query-provider'
import { AuthProvider }  from '@/features/auth/context/auth-context'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Stock Apple',
  description: 'Manejo de Stock de Productos Apple',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for (let registration of registrations) {
                  registration.unregister();
                }
              });
            }
          `
        }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>
          <AuthProvider sassBackUrl={process.env.NEXT_PUBLIC_REAL_BACK_URL!}>
            <TrpcProvider>{children}</TrpcProvider>
            <Toaster
              theme="dark"
              position="top-right"
              toastOptions={{
                style: {
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                },
              }}
            />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
EOF
ok "dashboard-front/app/layout.tsx"

sep
echo -e "${BOLD}  FIX 9 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Verificar en Railway que exista la variable:${NC}"
echo "    NEXT_PUBLIC_REAL_BACK_URL=https://tu-sass-back.up.railway.app"
echo ""
echo "  git add . && git commit -m 'fix: init firebase before AuthProvider in dashboard-front' && git push"
echo ""
sep