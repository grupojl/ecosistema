"use client"

/**
 * Tema claro / oscuro de Welver (welver.html → «Temas y tokens»).
 *
 * Welver tiene UNA identidad con DOS modos. El usuario elige Sistema (default), Claro u Oscuro; la elección se guarda
 * en localStorage bajo la clave `theme` y se aplica como clase `dark` en <html>, antes del primer pintado (sin parpadeo).
 * Es el mismo contrato que usa welver.html, así que el modo se comparte entre los fronts del mismo dominio.
 *
 *   // layout raíz de cada front
 *   <html lang="es" suppressHydrationWarning>
 *     <body><ThemeProvider>{children}</ThemeProvider></body>
 *   </html>
 *
 *   <ThemeToggle />            // control segmentado: Sistema · Claro · Oscuro
 *   <ThemeToggle compact />    // un botón de ícono que alterna entre los tres modos
 */
import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

import { cn } from "@real/ui/utils"
import { SegmentedControl } from "./segmented-control"

export const THEME_STORAGE_KEY = "theme"


type ThemeProviderProps = Omit<
  React.ComponentProps<typeof NextThemesProvider>,
  "attribute" | "defaultTheme" | "enableSystem" | "storageKey"
>

/** Modo por clase `dark`, default Sistema. Sin transición al cambiar (evita que todo "parpadee" a la vez). */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

type Mode = "system" | "light" | "dark"

const MODES: ReadonlyArray<{ value: Mode; label: string; Icon: typeof Sun }> = [
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
]

/** Evita el desajuste de hidratación: el modo guardado solo se conoce en el navegador. */
function useMounted() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted
}

export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const current: Mode = mounted && (theme === "light" || theme === "dark") ? theme : "system"

  if (compact) {
    const index = MODES.findIndex((m) => m.value === current)
    const next = MODES[(index + 1) % MODES.length]!
    const { Icon, label } = MODES[index]!
    return (
      <button
        type="button"
        onClick={() => setTheme(next.value)}
        className={cn(
          "inline-grid h-11 w-11 place-items-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          className
        )}
        aria-label={`Tema: ${label}. Cambiar a ${next.label}`}
        title={`Tema: ${label}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <SegmentedControl
      aria-label="Tema"
      className={className}
      value={current}
      onValueChange={(v) => setTheme(v)}
      options={MODES.map(({ value, label, Icon }) => ({
        value,
        label: (
          <>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </>
        ),
      }))}
    />
  )
}
