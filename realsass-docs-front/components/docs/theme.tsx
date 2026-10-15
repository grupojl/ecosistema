'use client'

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@real/ui'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar tema"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="size-4 scale-100 dark:scale-0" aria-hidden />
      <Moon className="absolute size-4 scale-0 dark:scale-100" aria-hidden />
    </Button>
  )
}
