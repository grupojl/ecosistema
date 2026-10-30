import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider, ToastViewport } from '@/components/ui'
import { DesignShell } from './design-shell'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Welver — Sistema de diseño', template: '%s · Sistema de diseño' },
  description: 'Tokens, componentes y patrones de @real/ui compartidos por los fronts del ecosistema.',
  robots: { index: false, follow: false },
}

const inter         = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const sourceSerif   = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1511' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
          Saltar al contenido
        </a>
        <ThemeProvider>
          <DesignShell>{children}</DesignShell>
          <ToastViewport />
        </ThemeProvider>
      </body>
    </html>
  )
}
