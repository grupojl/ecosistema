'use client'
/**
 * context/auth-context.tsx — realsass-sass-front
 *
 * Contexto de autenticación global.
 *
 * Flujo de login:
 *   1. Firebase SDK → onAuthStateChanged → user
 *   2. auth.sync (tRPC) → upsert usuario + custom claims (ADR-003)
 *   3. getIdToken(true) → token fresco con claims
 *   4. POST /auth/session (REST) → cookie HttpOnly __session (ADR-004)
 *      ↑ Este paso es REST intencionalmente — necesita Set-Cookie header
 *   5. auth.me (tRPC) → perfil completo
 *   6. Timer de refresh proactivo a los 55 min
 *
 * Sesión compartida entre fronts: la cookie __session es la fuente de verdad (ADR-004). El usuario de
 * Firebase vive por origen y no se comparte: si el login se hizo en otro front (p. ej. el dashboard) no
 * hay `firebaseUser` acá, pero la cookie sigue válida → se autentica con auth.me por cookie
 * (`isAuthenticated`, sin refresh proactivo: la cookie vence a los 14 días).
 *
 * Tiempo real entre fronts: useSessionWatch revalida (auth.ping) al volver a la pestaña y cada ~30 s;
 * si otro front cerró la sesión este se desloguea, y si la abrió este entra solo.
 *
 * Flujo de logout:
 *   1. DELETE /auth/session (REST) → revoca cookie HttpOnly
 *   2. Firebase signOut
 */
import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef, type ReactNode,
} from 'react'
import { useRouter }                        from 'next/navigation'
import { getFirebaseAuth, onAuthStateChanged, signOut, signInWithGoogle, setActiveOrganizationId, pingSession, useSessionWatch, notifySessionChange, sessionRefreshDue, markSessionRefreshed, clearSessionRefreshed, reauthenticate as firebaseReauthenticate, type User } from '@real/auth-client'
import { AppError }                         from '@/lib/errors'

// ─── Tipos locales (sin lib/types.ts) ────────────────────────────────────────

export interface OrganizationSummary { id: string; name: string | null; slug: string | null }

export interface UserProfile {
  user:           { id: string; email: string | null; displayName: string | null; photoUrl: string | null }
  /** Organización por defecto (la más antigua que posee). */
  organization:   OrganizationSummary | null
  /** D3: todas las organizaciones que posee el usuario. */
  organizations:  OrganizationSummary[]
  collaborations: Array<{ organizationId: string; role: string; permissions: Record<string, boolean> }>
}

// ─── Helpers de session cookie (ADR-004) — REST por diseño ───────────────────

function getSassBackUrl(): string {
  return process.env.NEXT_PUBLIC_SASS_BACK_URL ?? ''
}

/** Devuelve true solo si el back confirmó la cookie (antes un 401/500 se ignoraba en silencio). */
async function createSessionCookie(idToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${getSassBackUrl()}/auth/session`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ idToken }),
    })
    if (!res.ok) console.warn('[auth] POST /auth/session respondió', res.status)
    return res.ok
  } catch (err) {
    console.warn('[auth] createSessionCookie failed', err)
    return false
  }
}

async function deleteSessionCookie(): Promise<void> {
  try {
    await fetch(`${getSassBackUrl()}/auth/session`, {
      method:      'DELETE',
      credentials: 'include',
    })
  } catch (err) {
    console.warn('[auth] deleteSessionCookie failed', err)
  }
}

// ─── Helpers tRPC imperativo (fuera de hooks — solo en el context) ────────────
// Usamos fetch directo al endpoint tRPC porque estamos fuera del ciclo de React.
// Los componentes deben usar useMe() y useSyncUser() de use-auth-trpc.ts.

async function trpcSyncUser(token: string, affiliateCode?: string): Promise<void> {
  const url   = `${getSassBackUrl()}/api/v1/trpc/auth.sync`
  const input = { affiliateCode }
  const res = await fetch(`${url}?input=${encodeURIComponent(JSON.stringify(input))}`, {
    method:      'POST',
    credentials: 'include',
    headers:     {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(input), // el input va tal cual en el body (el POST ignora el query string)
  })
  if (!res.ok) {
    throw new AppError('No pudimos preparar tu cuenta', res.status === 401 ? 'AUTH' : 'UNKNOWN', res.status)
  }
}

/** Con `token` va como Bearer; sin token autentica la cookie HttpOnly (sesión iniciada en otro front). */
async function trpcGetMe(token: string | null): Promise<UserProfile | null> {
  try {
    const url = `${getSassBackUrl()}/api/v1/trpc/auth.me`
    const res = await fetch(url, {
      credentials: 'include',
      headers:     token ? { 'Authorization': `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    // Sin transformer en el router: el resultado viene en result.data (antes se leía .json y daba siempre null)
    const json = await res.json()
    return (json?.result?.data as UserProfile | undefined) ?? null
  } catch {
    return null
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  firebaseUser:   User | null
  /** Hay sesión: usuario de Firebase en este origen o cookie válida creada en otro front. */
  isAuthenticated: boolean
  profile:        UserProfile | null
  loading:        boolean
  busy:           boolean
  /**
   * true cuando la cookie de sesión ya está creada y la organización activa resuelta.
   * Las consultas autenticadas (tRPC) deben esperar a este valor: evita los 401 de arranque.
   */
  sessionReady:   boolean
  /** D4: organización activa; viaja en el header x-organization-id. */
  activeOrganizationId: string | null
  switchOrganization:   (organizationId: string) => void
  /** Step-up: confirma la identidad con el proveedor y renueva la cookie (auth_time fresco). */
  reauthenticate: () => Promise<void>
  refreshProfile: () => Promise<void>
  logout:         () => Promise<void>
}

const ACTIVE_ORG_KEY = 'activeOrganizationId'

function readStoredOrg(): string | null {
  try { return window.localStorage.getItem(ACTIVE_ORG_KEY) } catch { return null }
}
function storeOrg(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_ORG_KEY, id)
    else window.localStorage.removeItem(ACTIVE_ORG_KEY)
  } catch { /* storage bloqueado: la org activa vive solo en memoria */ }
}

/** La org guardada si el usuario aún tiene acceso; si no, la primera propia o, en su defecto, la primera colaboración. */
function resolveActiveOrg(profile: UserProfile): string | null {
  const accessible = new Set([
    ...profile.organizations.map(o => o.id),
    ...profile.collaborations.map(c => c.organizationId),
  ])
  const stored = readStoredOrg()
  if (stored && accessible.has(stored)) return stored
  return profile.organizations[0]?.id ?? profile.collaborations[0]?.organizationId ?? null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps { children: ReactNode; refCode?: string }

export function AuthProvider({ children, refCode }: AuthProviderProps) {
  const router = useRouter()

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile,      setProfile]      = useState<UserProfile | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [busy,         setBusy]         = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [activeOrganizationId, setActiveOrgState] = useState<string | null>(null)

  const applyActiveOrg = useCallback((id: string | null) => {
    setActiveOrganizationId(id) // módulo de @real/auth-client: lo lee el header de tRPC
    storeOrg(id)
    setActiveOrgState(id)
  }, [])

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileRef       = useRef<UserProfile | null>(null)
  const syncingRef       = useRef(false) // login/sync en curso: no revalidar encima
  profileRef.current     = profile

  const scheduleTokenRefresh = useCallback((user: User) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const freshToken = await user.getIdToken(true)
        if (await createSessionCookie(freshToken)) markSessionRefreshed()
      } catch { /* si falla el refresh el próximo request recibe 401 */ }
    }, 55 * 60 * 1000)
  }, [])

  const syncAndLoad = useCallback(async (user: User) => {
    setBusy(true)
    try {
      // Recarga (F5) con la cookie renovada hace poco: 1 request en vez de toda la cadena. POST /auth/session
      // tiene un límite de 10/min y varios F5 seguidos daban 429 → "preparando la sesión".
      if (!sessionRefreshDue()) {
        const viaCookie = await trpcGetMe(null)
        if (viaCookie) {
          setProfile(viaCookie)
          applyActiveOrg(resolveActiveOrg(viaCookie))
          setSessionReady(true)
          scheduleTokenRefresh(user)
          return
        }
      }

      const token = await user.getIdToken()
      await trpcSyncUser(token, refCode)

      // Forzar refresh para incluir custom claims recién emitidos (ADR-003)
      const freshToken = await user.getIdToken(true)

      // REST — bootstrap del sistema de auth (ADR-004)
      const cookieOk = await createSessionCookie(freshToken)
      if (cookieOk) markSessionRefreshed()

      const me = await trpcGetMe(freshToken)
      if (me) {
        setProfile(me)
        applyActiveOrg(resolveActiveOrg(me))
      }
      // Las consultas tRPC autenticadas arrancan recién ahora (cookie confirmada + org activa lista).
      // Lista si hay una cookie válida: la recién creada o, si falló (p. ej. 429), una anterior.
      setSessionReady(cookieOk || !!(await trpcGetMe(null)))

      scheduleTokenRefresh(user)
    } catch (err) {
      if (err instanceof AppError && err.code === 'AUTH') {
        await signOut()
      }
    } finally {
      setBusy(false)
    }
  }, [refCode, scheduleTokenRefresh, applyActiveOrg])

  useEffect(() => {
    let cancelled = false
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      syncingRef.current = true
      try {
      setFirebaseUser(user)
      if (user) {
        await syncAndLoad(user)
        notifySessionChange() // otras pestañas de este origen
      } else {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        // Sin usuario de Firebase en este origen: ¿hay una sesión por cookie de otro front?
        if (!profileRef.current) setLoading(true)
        const me = await trpcGetMe(null)
        if (cancelled) return
        if (me) {
          setProfile(me)
          applyActiveOrg(resolveActiveOrg(me))
          setSessionReady(true)
        } else {
          setProfile(null)
          setSessionReady(false)
          applyActiveOrg(null)
        }
      }
      setLoading(false)
      } finally {
        syncingRef.current = false
      }
    })
    return () => {
      cancelled = true
      unsubscribe()
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [syncAndLoad, applyActiveOrg])

  /** auth.ping: refleja un login/logout hecho en otro front. Un corte de red no desloguea a nadie. */
  const revalidate = useCallback(async () => {
    if (syncingRef.current) return
    const status = await pingSession(getSassBackUrl())
    if (syncingRef.current || status === 'unknown') return

    if (status === 'closed' && profileRef.current) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      setProfile(null)
      setSessionReady(false)
      applyActiveOrg(null)
      clearSessionRefreshed()
      await signOut().catch(() => undefined) // el usuario de Firebase de este origen también
    } else if (status === 'open' && !profileRef.current) {
      const me = await trpcGetMe(null)
      if (me && !syncingRef.current && !profileRef.current) {
        setProfile(me)
        applyActiveOrg(resolveActiveOrg(me))
        setSessionReady(true)
      }
    }
  }, [applyActiveOrg])

  useSessionWatch(revalidate)

  // Arranque rápido: la cookie ya es una sesión válida. El perfil se pide de una (1 request) sin esperar a que
  // Firebase inicialice y encadene sync → token → cookie → me; esa renovación sigue en segundo plano.
  useEffect(() => {
    let cancelled = false
    void trpcGetMe(null).then((me) => {
      if (cancelled || !me || profileRef.current) return
      setProfile(me)
      applyActiveOrg(resolveActiveOrg(me))
      setSessionReady(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [applyActiveOrg])

  const switchOrganization = useCallback((organizationId: string) => {
    // D4: cambiar de organización NO reemite la cookie; solo cambia el header de los próximos requests.
    applyActiveOrg(organizationId)
  }, [applyActiveOrg])

  const reauthenticate = useCallback(async () => {
    // Sesión por cookie de otro front: no hay usuario de Firebase acá → se confirma con Google (inicia sesión en este origen).
    const confirmed = firebaseUser ?? await signInWithGoogle()
    if (firebaseUser) await firebaseReauthenticate()
    const fresh = await confirmed.getIdToken(true) // trae el auth_time nuevo
    if (!(await createSessionCookie(fresh))) {
      throw new AppError('No pudimos renovar tu sesión segura. Intentá de nuevo.', 'UNKNOWN')
    }
    markSessionRefreshed()
  }, [firebaseUser])

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser && !profile) return
    setBusy(true)
    try {
      const token = firebaseUser ? await firebaseUser.getIdToken() : null
      const me    = await trpcGetMe(token)
      if (me) {
        setProfile(me)
        // Si la org activa ya no es accesible (p. ej. te quitaron el acceso), se re-resuelve.
        const ids = new Set([...me.organizations.map(o => o.id), ...me.collaborations.map(c => c.organizationId)])
        if (!activeOrganizationId || !ids.has(activeOrganizationId)) applyActiveOrg(resolveActiveOrg(me))
      }
    } finally {
      setBusy(false)
    }
  }, [firebaseUser, profile, activeOrganizationId, applyActiveOrg])

  const logout = useCallback(async () => {
    setBusy(true)
    try {
      await deleteSessionCookie()
      await signOut()
      setProfile(null)
      setSessionReady(false)
      applyActiveOrg(null)
      clearSessionRefreshed()
      notifySessionChange()
      router.push('/')
    } finally {
      setBusy(false)
    }
  }, [router, applyActiveOrg])

  return (
    <AuthContext.Provider value={{ firebaseUser, isAuthenticated: !!firebaseUser || !!profile, profile, loading, busy, sessionReady, activeOrganizationId, switchOrganization, reauthenticate, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
