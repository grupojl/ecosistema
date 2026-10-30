import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Metadata, Viewport } from 'next'
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'
import { BookOpen } from 'lucide-react'
import { PageContainer, SiteBrand, SiteHeader, ThemeProvider, ThemeToggle, THEME_COLOR } from '@real/ui'
import { I18nProvider, LocaleSwitcher, localeDir } from '@real/i18n'
import { getRequestLocale } from '@real/i18n/server'
import { listDocs } from '@/lib/docs'
import { getDictionary } from '@/lib/i18n'
import { DocsNav } from './docs-nav'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Ecosistema Real — Ayuda', template: '%s · Ecosistema Real' },
  description: 'Guías para usar tu panel: empezar, informar un problema, WhatsApp y dispositivos.',
}

const inter         = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sourceSerif   = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [...THEME_COLOR],
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const docs = await listDocs()
  const locale = await getRequestLocale()
  const d = getDictionary(locale)
  return (
    <html lang={locale} dir={localeDir(locale)} suppressHydrationWarning className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <I18nProvider locale={locale} messages={d}>
        <ThemeProvider>
          <SiteHeader
            navLabel={d.docs.navLabel}
            linkAs={Link}
            brand={<SiteBrand name={d.docs.siteName} icon={<BookOpen />} href="/" linkAs={Link} />}
            links={docs.map((d) => ({ id: d.slug, label: d.title, href: `/${d.slug}` }))}
            actions={<><LocaleSwitcher label={d.common.language} compact /><ThemeToggle compact /></>}
          />
          <main className="min-h-[calc(100dvh-3.5rem)] bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] medium:pb-0">
            {/* Las guías están en español: se marca para lectores de pantalla y traductores aunque la interfaz esté en otro idioma. */}
            <PageContainer size="sm"><div lang="es">{children}</div></PageContainer>
          </main>
          <DocsNav docs={docs} />
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
