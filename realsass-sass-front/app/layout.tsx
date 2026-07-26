import { TrpcProvider } from '@/lib/trpc/provider';
import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'

import { AuthProvider } from '@/components/auth-provider-wrapper'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const dmSans  = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const dmSerif = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-dm-serif' })

export const metadata: Metadata = {
  title: 'Propiedad - The Real Estate Platform for Modern Agencies',
  description: 'Propiedad is the all-in-one SaaS platform that helps real estate agencies manage listings, close deals faster, and grow their business.',
}

export const viewport: Viewport = {
  themeColor: '#f5f0eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <TrpcProvider>{children}</TrpcProvider>
        </AuthProvider>
        <Toaster />

      </body>
    </html>
  )
}
