// app/[locale]/layout.tsx — root layout del storefront público (indexable)
// dynamicParams=false: un primer segmento fuera de LOCALES → 404, no 500.
import { CustomerProvider } from '@/context/customer-context'
import { TrpcProvider }    from '@/lib/trpc/provider'
import type { Metadata, Viewport } from 'next'
import { ThemeProvider, THEME_COLOR } from '@real/ui'
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'
import { Analytics }       from '@vercel/analytics/next'
import { notFound }        from 'next/navigation'
import { LOCALES, isLocale, isRtlLocale, type Locale } from '@/lib/i18n'
import { getSiteUrl }                                    from '@/lib/seo/site'
import '../globals.css'

// Tipografía Welver (.claude/domain/welver.html): Inter (texto), Source Serif 4 (títulos), JetBrains Mono (código)
const inter         = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sourceSerif   = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' })

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

const site = getSiteUrl()
export const viewport: Viewport = {
  themeColor: [...THEME_COLOR],
}

export const metadata: Metadata = {
  ...(site ? { metadataBase: site } : {}),
  generator: 'v0.app',
}

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <html lang={locale} dir={isRtlLocale(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider>
        <CustomerProvider><TrpcProvider>{children}</TrpcProvider></CustomerProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

export function useLocaleParam(locale: string): Locale {
  if (!isLocale(locale)) notFound()
  return locale
}
