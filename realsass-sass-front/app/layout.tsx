import { TrpcProvider } from '@/lib/trpc/provider';
import type { Metadata, Viewport } from 'next'
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'

import { AuthProvider } from '@/components/auth-provider-wrapper'
import { ThemeProvider, ToastViewport, THEME_COLOR } from '@real/ui'
import { I18nProvider, localeDir } from '@real/i18n'
import { getRequestLocale } from '@real/i18n/server'
import { getDictionary } from '@/lib/i18n'
import './globals.css'

// Tipografía Welver (.claude/domain/welver.html): Inter (texto), Source Serif 4 (títulos), JetBrains Mono (código)
const inter         = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sourceSerif   = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' })
const fontVars      = `${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`

export const metadata: Metadata = {
  title: 'Propiedad - The Real Estate Platform for Modern Agencies',
  description: 'Propiedad is the all-in-one SaaS platform that helps real estate agencies manage listings, close deals faster, and grow their business.',
  // Privado por defecto (/profile, /settings, /invite, /auth…). Solo la landing (app/page.tsx) se declara indexable.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [...THEME_COLOR],
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale()
  return (
    <html lang={locale} dir={localeDir(locale)} suppressHydrationWarning className={fontVars}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <I18nProvider locale={locale} messages={getDictionary(locale)}>
        <ThemeProvider>
        <AuthProvider>
          <TrpcProvider>{children}</TrpcProvider>
        </AuthProvider>
        <ToastViewport />
        </ThemeProvider>
        </I18nProvider>

      </body>
    </html>
  )
}
