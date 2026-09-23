// app/(site)/layout.tsx — root layout de páginas SIN slug de tienda
// (home genérica, checkout, tracking, redirects legacy). No es indexable
// por idioma: no tiene contexto de tienda para derivar countryCode.
import { CustomerProvider } from '@/context/customer-context'
import { TrpcProvider }    from '@/lib/trpc/provider'
import type { Metadata }   from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics }       from '@vercel/analytics/next'
import Header from '@/components/header'
import Footer from '@/components/footer'
import '../globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Welver',
  description: 'Plataforma de tiendas online multi-tenant.',
  robots: { index: false, follow: true }, // sin slug no hay contenido propio que indexar
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <Header />
        <CustomerProvider><TrpcProvider>{children}</TrpcProvider></CustomerProvider>
        <Analytics />
        <Footer />
      </body>
    </html>
  )
}
