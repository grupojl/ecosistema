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
import { auth, onAuthStateChanged, signOut, type User } from '@real/auth-client'
import { AppError }                         from '@/lib/errors'

// ─── Tipos locales (sin lib/types.ts) ────────────────────────────────────────

export interface UserProfile {
  user:           { id: string; email: string | null; displayName: string | null; photoUrl: string | null }
  organization:   { id: string; name: string | null; slug: string | null } | null
  collaborations: Array<{ organizationId: string; role: string; permissions: Record<string, boolean> }>
}

// ─── Helpers de session cookie (ADR-004) — REST por diseño ───────────────────

function getSassBackUrl(): string {
  return process.env.NEXT_PUBLIC_SASS_BACK_URL ?? ''
}

async function createSessionCookie(idToken: string): Promise<void> {
  try {
    await fetch(`${getSassBackUrl()}/auth/session`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ idToken }),
    })
  } catch (err) {
    console.warn('[auth] createSessionCookie failed', err)
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
  await fetch(`${url}?input=${encodeURIComponent(JSON.stringify(input))}`, {
    method:      'POST',
    credentials: 'include',
    headers:     {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ json: input }),
  })
}

async function trpcGetMe(token: string): Promise<UserProfile | null> {
  try {
    const url = `${getSassBackUrl()}/api/v1/trpc/auth.me`
    const res = await fetch(url, {
      credentials: 'include',
      headers:     { 'Authorization': `Bearer ${token}` },
    })
    const json = await res.json()
    return json?.result?.data?.json ?? null
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
  refreshProfile: () => Promise<void>
  logout:         () => Promise<void>
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
      await createSessionCookie(freshToken)

      const me = await trpcGetMe(freshToken)
      if (me) setProfile(me)

      scheduleTokenRefresh(user)
    } catch (err) {
      if (err instanceof AppError && err.code === 'AUTH') {
        await signOut(auth)
      }
    } finally {
      setBusy(false)
    }
  }, [refCode, scheduleTokenRefresh])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      if (user) {
        await syncAndLoad(user)
      } else {
        setProfile(null)
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      }
      setLoading(false)
    })
    return () => {
      unsubscribe()
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [syncAndLoad])

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return
    setBusy(true)
    try {
      const token = await firebaseUser.getIdToken()
      const me    = await trpcGetMe(token)
      if (me) setProfile(me)
    } finally {
      setBusy(false)
    }
  }, [firebaseUser])

  const logout = useCallback(async () => {
    setBusy(true)
    try {
      await deleteSessionCookie()
      await signOut(auth)
      setProfile(null)
      router.push('/')
    } finally {
      setBusy(false)
    }
  }, [router])

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, busy, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
