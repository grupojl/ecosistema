// app/[locale]/layout.tsx — root layout del storefront público (indexable)
// dynamicParams=false: un primer segmento fuera de LOCALES → 404, no 500.
import { CustomerProvider } from '@/context/customer-context'
import { TrpcProvider }    from '@/lib/trpc/provider'
import type { Metadata }   from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics }       from '@vercel/analytics/next'
import { notFound }        from 'next/navigation'
import { LOCALES, isLocale, isRtlLocale, type Locale } from '@/lib/i18n'
import { getSiteUrl }                                    from '@/lib/seo/site'
import '../globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

const site = getSiteUrl()
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
    <html lang={locale} dir={isRtlLocale(locale) ? "rtl" : "ltr"}>
      <body className="font-sans antialiased">
        <CustomerProvider><TrpcProvider>{children}</TrpcProvider></CustomerProvider>
        <Analytics />
      </body>
    </html>
  )
}

export function useLocaleParam(locale: string): Locale {
  if (!isLocale(locale)) notFound()
  return locale
}
