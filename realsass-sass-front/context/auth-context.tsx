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
 * Flujo de logout:
 *   1. DELETE /auth/session (REST) → revoca cookie HttpOnly
 *   2. Firebase signOut
 */
import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef, type ReactNode,
} from 'react'
import { useRouter }                        from 'next/navigation'
import { getFirebaseAuth, onAuthStateChanged, signOut, setActiveOrganizationId, reauthenticate as firebaseReauthenticate, type User } from '@real/auth-client'
import { AppError }                         from '@/lib/errors'
import { createBearerCaller, trpcHttpStatus } from '@/lib/trpc/vanilla'

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

// ─── tRPC imperativo (fuera de hooks — solo en el context) ────────────────────
// Cliente tipado de lib/trpc/vanilla.ts (antes: fetch + ?input= armado a mano, sin tipos).
// Los componentes deben usar useMe() y useSyncUser() de use-auth-trpc.ts.

async function trpcSyncUser(token: string, affiliateCode?: string): Promise<void> {
  try {
    await createBearerCaller(getSassBackUrl(), token).auth.sync.mutate({ affiliateCode })
  } catch (err) {
    const status = trpcHttpStatus(err)
    throw new AppError('No pudimos preparar tu cuenta', status === 401 ? 'AUTH' : 'UNKNOWN', status)
  }
}

async function trpcGetMe(token: string): Promise<UserProfile | null> {
  try {
    return await createBearerCaller(getSassBackUrl(), token).auth.me.query()
  } catch {
    return null
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  firebaseUser:   User | null
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

  const scheduleTokenRefresh = useCallback((user: User) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const freshToken = await user.getIdToken(true)
        await createSessionCookie(freshToken)
      } catch { /* si falla el refresh el próximo request recibe 401 */ }
    }, 55 * 60 * 1000)
  }, [])

  const syncAndLoad = useCallback(async (user: User) => {
    setBusy(true)
    try {
      const token = await user.getIdToken()
      await trpcSyncUser(token, refCode)

      // Forzar refresh para incluir custom claims recién emitidos (ADR-003)
      const freshToken = await user.getIdToken(true)

      // REST — bootstrap del sistema de auth (ADR-004)
      const cookieOk = await createSessionCookie(freshToken)

      const me = await trpcGetMe(freshToken)
      if (me) {
        setProfile(me)
        applyActiveOrg(resolveActiveOrg(me))
      }
      // Las consultas tRPC autenticadas arrancan recién ahora (cookie confirmada + org activa lista).
      setSessionReady(cookieOk)

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
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      setFirebaseUser(user)
      if (user) {
        await syncAndLoad(user)
      } else {
        setProfile(null)
        setSessionReady(false)
        applyActiveOrg(null)
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      }
      setLoading(false)
    })
    return () => {
      unsubscribe()
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [syncAndLoad, applyActiveOrg])

  const switchOrganization = useCallback((organizationId: string) => {
    // D4: cambiar de organización NO reemite la cookie; solo cambia el header de los próximos requests.
    applyActiveOrg(organizationId)
  }, [applyActiveOrg])

  const reauthenticate = useCallback(async () => {
    if (!firebaseUser) throw new AppError('Tu sesión terminó. Ingresá de nuevo.', 'AUTH')
    await firebaseReauthenticate()
    const fresh = await firebaseUser.getIdToken(true) // trae el auth_time nuevo
    if (!(await createSessionCookie(fresh))) {
      throw new AppError('No pudimos renovar tu sesión segura. Intentá de nuevo.', 'UNKNOWN')
    }
  }, [firebaseUser])

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return
    setBusy(true)
    try {
      const token = await firebaseUser.getIdToken()
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
  }, [firebaseUser, activeOrganizationId, applyActiveOrg])

  const logout = useCallback(async () => {
    setBusy(true)
    try {
      await deleteSessionCookie()
      await signOut()
      setProfile(null)
      setSessionReady(false)
      applyActiveOrg(null)
      router.push('/')
    } finally {
      setBusy(false)
    }
  }, [router, applyActiveOrg])

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, busy, sessionReady, activeOrganizationId, switchOrganization, reauthenticate, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
