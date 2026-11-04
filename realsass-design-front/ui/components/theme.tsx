"use client"

/**
 * Tema claro / oscuro de Welver (welver.html → «Temas y tokens»).
 *
 * Welver tiene UNA identidad con DOS modos. El usuario elige Sistema (default), Claro u Oscuro; la elección se guarda
 * en localStorage bajo la clave `theme` y se aplica como clase `dark` en <html>, antes del primer pintado (sin parpadeo).
 * Es el mismo contrato que usa welver.html. localStorage no cruza orígenes (cada front tiene su puerto/subdominio), así que el modo
 * también se publica en la cookie `welver-theme`: `ThemeSync` la lee y todos los fronts abiertos cambian a la vez, en vivo.
 * En producción definir NEXT_PUBLIC_THEME_COOKIE_DOMAIN (p. ej. `.midominio.com`) en todos los fronts; en localhost se comparte sola.
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
/** Cookie que comparte el modo entre fronts (las cookies ignoran el puerto y, con Domain, cruzan subdominios). */
export const THEME_COOKIE = "welver-theme"
const THEME_SYNC_MS = 1000

// NEXT_PUBLIC_* se incrusta al compilar cada front; la declaración evita depender de @types/node en este paquete.
declare const process: { env: Record<string, string | undefined> }
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_THEME_COOKIE_DOMAIN

type ThemeMode = "system" | "light" | "dark"
const isMode = (v: unknown): v is ThemeMode => v === "system" || v === "light" || v === "dark"

function readThemeCookie(): ThemeMode | null {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + THEME_COOKIE + "=([^;]*)"))
    const v = m ? decodeURIComponent(m[1]!) : null
    return isMode(v) ? v : null
  } catch { return null }
}

function writeThemeCookie(mode: ThemeMode) {
  try {
    const domain = COOKIE_DOMAIN ? "; Domain=" + COOKIE_DOMAIN : ""
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie = THEME_COOKIE + "=" + mode + "; Path=/; Max-Age=31536000; SameSite=Lax" + domain + secure
  } catch { /* cookies bloqueadas: el tema sigue funcionando por localStorage en este front */ }
}

/** Mantiene el modo igual en todos los fronts: publica el cambio propio y adopta el de los demás (al montar, al volver y cada segundo). */
function ThemeSync() {
  const { theme, setTheme } = useTheme()
  const current = isMode(theme) ? theme : null
  const currentRef = React.useRef(current)
  currentRef.current = current

  // Cambio hecho en ESTE front → se publica. (Si venía de la cookie, ya es igual y no se reescribe.)
  React.useEffect(() => {
    if (current && readThemeCookie() !== current) writeThemeCookie(current)
  }, [current])

  // Cambio hecho en OTRO front → se adopta.
  React.useEffect(() => {
    const pull = () => {
      const fromCookie = readThemeCookie()
      if (fromCookie && fromCookie !== currentRef.current) setTheme(fromCookie)
    }
    pull()
    const id = window.setInterval(() => { if (document.visibilityState === "visible") pull() }, THEME_SYNC_MS)
    document.addEventListener("visibilitychange", pull)
    window.addEventListener("focus", pull)
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", pull); window.removeEventListener("focus", pull) }
  }, [setTheme])

  return null
}


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
      <ThemeSync />
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
