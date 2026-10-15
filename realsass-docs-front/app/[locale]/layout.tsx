import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { ThemeProvider } from '@/components/docs/theme'
import { SiteHeader } from '@/components/docs/site-header'
import { docs } from '@/lib/docs'
import { isLocale } from '@/lib/docs/types'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_URL ?? 'http://localhost:3024'),
  title: { default: 'Documentación', template: '%s · Documentación' },
  description: 'Guías, tutoriales y referencia para usar y extender el ecosistema.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}


export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const groups = await docs.getNavigation(locale)

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <ThemeProvider>
          <SiteHeader locale={locale} groups={groups} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
