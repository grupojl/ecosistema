// app/(site)/layout.tsx — root layout de páginas SIN slug de tienda
// (home genérica, checkout, tracking, redirects legacy). No es indexable
// por idioma: no tiene contexto de tienda para derivar countryCode.
import { CustomerProvider } from '@/context/customer-context'
import { TrpcProvider }    from '@/lib/trpc/provider'
import type { Metadata, Viewport } from 'next'
import { ThemeProvider, THEME_COLOR } from '@real/ui'
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'
import { Analytics }       from '@vercel/analytics/next'
import Header from '@/components/header'
import Footer from '@/components/footer'
import '../globals.css'

const inter         = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sourceSerif   = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' })

export const viewport: Viewport = {
  themeColor: [...THEME_COLOR],
}

export const metadata: Metadata = {
  title: 'Welver',
  description: 'Plataforma de tiendas online multi-tenant.',
  robots: { index: false, follow: true }, // sin slug no hay contenido propio que indexar
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <Header />
          <CustomerProvider><TrpcProvider>{children}</TrpcProvider></CustomerProvider>
          <Footer />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
