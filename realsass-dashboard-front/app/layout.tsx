import { TrpcProvider }  from '@/lib/trpc/provider'
import type { Metadata, Viewport } from 'next'
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider, ToastViewport, THEME_COLOR } from '@real/ui'
import { I18nProvider, localeDir } from '@real/i18n'
import { getRequestLocale } from '@real/i18n/server'
import { getDictionary } from '@/lib/i18n'
import { QueryProvider } from '@/providers/query-provider'
import { AuthProvider }  from '@/features/auth/context/auth-context'
import { SwCleanup }     from '@/components/sw-cleanup'
import { DesktopGuard }  from '@/components/desktop/desktop-guard'
import './globals.css'

// Tipografía Welver (.claude/domain/welver.html): Inter (texto), Source Serif 4 (títulos), JetBrains Mono (código)
const inter         = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const sourceSerif   = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const viewport: Viewport = {
  themeColor: [...THEME_COLOR],
}

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getRequestLocale()
  return (
    <html lang={locale} dir={localeDir(locale)} suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <I18nProvider locale={locale} messages={getDictionary(locale)}>
        <ThemeProvider>
        <SwCleanup />
        <QueryProvider>
          <AuthProvider sassBackUrl={process.env.NEXT_PUBLIC_SASS_BACK_URL ?? process.env.NEXT_PUBLIC_REAL_BACK_URL ?? ''}>
            <TrpcProvider>
              {children}
              <DesktopGuard />
            </TrpcProvider>
            <ToastViewport position="top-right" />
          </AuthProvider>
        </QueryProvider>
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
