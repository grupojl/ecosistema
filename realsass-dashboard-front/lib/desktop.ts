/**
 * lib/desktop.ts — puente con la app de escritorio (realsass-dashboard-desktop, ADR-023). PURO.
 *
 * La app Tauri inyecta `window.__WELVER_DESKTOP__ = { loginPort, version }` en cada página que carga. Con eso el panel sabe que
 * corre dentro de la app y a qué puerto de loopback (127.0.0.1) hablarle para iniciar sesión por el navegador del sistema.
 *
 * Todo lo que llega por la URL (puerto, state, next) se valida acá antes de usarse: la página puente redirige a
 * `http://127.0.0.1:{puerto}`, así que un puerto o un `state` sin validar sería un redirect abierto.
 */

export interface DesktopBridge {
  loginPort: number
  version:   string
}

/** Puerto efímero: ni privilegiado ni fuera de rango. */
export function isValidLoopbackPort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1024 && port <= 65535
}

/** El `state` lo genera la app (hex de 64 caracteres); se acepta un rango razonable de caracteres seguros. */
export function isValidState(state: string | null | undefined): state is string {
  return typeof state === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(state)
}

/** "?port=51234" → 51234, o null si no es un puerto válido. */
export function parsePort(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,5}$/.test(raw)) return null
  const port = Number(raw)
  return isValidLoopbackPort(port) ? port : null
}

/** Dónde vuelve el navegador del sistema con el token. SOLO loopback; el puerto y el state ya deben estar validados. */
export function loopbackCallbackUrl(port: number, state: string, token: string): string {
  return `http://127.0.0.1:${port}/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}`
}

/** Dónde abre el login la app (el webview navega ahí; la app abre el navegador del sistema). */
export function loopbackStartUrl(port: number): string {
  return `http://127.0.0.1:${port}/start`
}

/** Solo rutas internas: evita que `?next=` mande a otro sitio ("//evil.com", "https://…", "/\\evil"). */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/'
  return raw
}

/** Devuelve el puente solo si la app lo inyectó y es válido; null en un navegador común. */
export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null
  const bridge = (window as unknown as { __WELVER_DESKTOP__?: { loginPort?: unknown; version?: unknown } }).__WELVER_DESKTOP__
  if (!bridge || !isValidLoopbackPort(bridge.loginPort)) return null
  return { loginPort: bridge.loginPort, version: typeof bridge.version === 'string' ? bridge.version : '' }
}
