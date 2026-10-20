/**
 * lib/desktop.ts — puente con la app de escritorio (realsass-dashboard-desktop, ADR-023). PURO.
 *
 * La app Tauri inyecta `window.__WELVER_DESKTOP__ = { loginPort, version }` en cada página que carga. Con eso el panel sabe que
 * corre dentro de la app y a qué puerto de loopback (127.0.0.1) hablarle para iniciar sesión por el navegador del sistema.
 *
 * Todo lo que llega por la URL (puerto, state, challenge, next) se valida acá antes de usarse: la página puente redirige a
 * `http://127.0.0.1:{puerto}`, así que un puerto o un `state` sin validar sería un redirect abierto.
 *
 * Login (DT-DESK-3): PKCE + código de un solo uso. Por el loopback viaja un CÓDIGO, nunca un token; el `verifier` solo lo conoce la app.
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

/** `challenge` PKCE = hex(SHA-256(verifier)): 64 caracteres hex. Lo genera la app. */
export function isValidChallenge(challenge: string | null | undefined): challenge is string {
  return typeof challenge === 'string' && /^[a-f0-9]{64}$/.test(challenge)
}

/** `verifier` PKCE: 64 caracteres hex (256 bits). */
export function isValidVerifier(verifier: string | null | undefined): verifier is string {
  return typeof verifier === 'string' && /^[a-f0-9]{64}$/.test(verifier)
}

/** Código de un solo uso que emite el back: base64url de 32 a 128 caracteres. */
export function isValidCode(code: string | null | undefined): code is string {
  return typeof code === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(code)
}

/** "?port=51234" → 51234, o null si no es un puerto válido. */
export function parsePort(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,5}$/.test(raw)) return null
  const port = Number(raw)
  return isValidLoopbackPort(port) ? port : null
}

/** Dónde vuelve el navegador del sistema con el CÓDIGO. SOLO loopback; el puerto, el state y el code ya deben estar validados. */
export function loopbackCallbackUrl(port: number, state: string, code: string): string {
  return `http://127.0.0.1:${port}/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`
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

// ─── Política de versiones y telemetría con consentimiento (DT-DESK-11 y 13) ──────────────────────────────────────────

export interface DesktopPolicy {
  minVersion:      string | null
  blockedVersions: string[]
  downloadUrl:     string | null
}

export type VersionVerdict = 'ok' | 'update-required' | 'blocked'

/** "1.2.3" → [1,2,3], o null si no es x.y.z. */
export function parseVersion(raw: string | null | undefined): [number, number, number] | null {
  const m = typeof raw === 'string' ? /^(\d+)\.(\d+)\.(\d+)$/.exec(raw) : null
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** <0 si a<b, 0 si iguales, >0 si a>b. Una versión ilegible se trata como la más vieja. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i]! - pb[i]!
  return 0
}

/**
 * ¿Puede seguir usándose esta versión de la app? Bloqueada gana sobre todo (es el "rollback": una release rota se bloquea y el
 * usuario pasa a la corregida). Sin política o con una política ilegible NO se bloquea a nadie: un fallo de red no puede dejar
 * a todos sin panel.
 */
export function evaluateVersion(version: string, policy: DesktopPolicy | null | undefined): VersionVerdict {
  if (!policy || !parseVersion(version)) return 'ok'
  if (policy.blockedVersions.includes(version)) return 'blocked'
  if (policy.minVersion && compareVersions(version, policy.minVersion) < 0) return 'update-required'
  return 'ok'
}

export type DesktopOs = 'windows' | 'macos' | 'linux' | 'unknown'

export function detectOs(userAgent: string | null | undefined): DesktopOs {
  const ua = (userAgent ?? '').toLowerCase()
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos'
  if (ua.includes('linux') || ua.includes('x11')) return 'linux'
  return 'unknown'
}

const CONSENT_KEY = 'welver.desktop.telemetry'
export type Consent = 'granted' | 'denied' | null

/** Consentimiento guardado en este equipo. Cualquier cosa distinta de granted/denied = todavía no se preguntó. */
export function readConsent(storage: Pick<Storage, 'getItem'> | null | undefined): Consent {
  try {
    const v = storage?.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch { return null }
}

export function writeConsent(storage: Pick<Storage, 'setItem'> | null | undefined, value: 'granted' | 'denied'): void {
  try { storage?.setItem(CONSENT_KEY, value) } catch { /* sin almacenamiento: se vuelve a preguntar */ }
}
