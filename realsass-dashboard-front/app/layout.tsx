import { TrpcProvider }  from '@/lib/trpc/provider'
import type { Metadata } from 'next'
import { Inter }         from 'next/font/google'
import { Toaster }       from 'sonner'
import { QueryProvider } from '@/providers/query-provider'
import { AuthProvider }  from '@/features/auth/context/auth-context'
import { SwCleanup }     from '@/components/sw-cleanup'
import { DesktopGuard }  from '@/components/desktop/desktop-guard'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: { default: 'Welver Dashboard', template: '%s · Welver Dashboard' },
  description: 'Panel de gestión de tu negocio: catálogo, stock, órdenes y colaboradores.',
  // App privada: ninguna página debe indexarse (ni /login). robots.txt lo refuerza.
  robots: { index: false, follow: false, nocache: true },
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <SwCleanup />
        <QueryProvider>
          <AuthProvider sassBackUrl={process.env.NEXT_PUBLIC_SASS_BACK_URL ?? process.env.NEXT_PUBLIC_REAL_BACK_URL ?? ''}>
            <TrpcProvider>
              {children}
              <DesktopGuard />
            </TrpcProvider>
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
