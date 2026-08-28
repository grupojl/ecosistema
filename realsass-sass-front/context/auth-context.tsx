import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useRouter }               from 'next/navigation'
import { auth, onAuthStateChanged, signOut, type User } from '@/lib/firebase'
import { syncUser, getMe }         from '@/lib/api'
import { AppError }                from '@/lib/errors'
import type { UserProfile }        from '@/lib/types'

// ─── Helpers de session cookie (ADR-004) ──────────────────────────────────────

function getSassBackUrl(): string {
  return process.env.NEXT_PUBLIC_SASS_BACK_URL ?? ''
}

/**
 * Crea la session cookie HttpOnly en sass-back.
 * Llamado después de syncUser exitoso — el ID token ya es válido y tiene claims.
 * No lanza — si falla, el usuario sigue autenticado con Bearer (degradación aceptable).
 */
async function createSessionCookie(idToken: string): Promise<void> {
  try {
    const res = await fetch(`${getSassBackUrl()}/auth/session`, {
      method:      'POST',
      credentials: 'include',  // necesario para que el back setee la cookie
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ idToken }),
    })
    if (!res.ok) {
      console.warn('[auth] createSessionCookie failed', res.status)
    }
  } catch (err) {
    console.warn('[auth] createSessionCookie network error', err)
  }
}

/**
 * Revoca la session cookie en sass-back + limpia la cookie del browser.
 * Llamado antes de signOut de Firebase.
 * No lanza — el logout de Firebase ocurre igual.
 */
async function deleteSessionCookie(): Promise<void> {
  try {
    await fetch(`${getSassBackUrl()}/auth/session`, {
      method:      'DELETE',
      credentials: 'include',
    })
  } catch (err) {
    console.warn('[auth] deleteSessionCookie network error', err)
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

interface AuthProviderProps {
  children: ReactNode
  refCode?: string
}

export function AuthProvider({ children, refCode }: AuthProviderProps) {
  const router = useRouter()

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile,      setProfile]      = useState<UserProfile | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [busy,         setBusy]         = useState(false)

  // Ref para el timer de refresh proactivo (antes de los 55 min de expiración)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Programa el refresh del token 55 minutos después de la última sincronización.
   * Firebase tokens expiran a los 60 min; los refrescamos 5 min antes para evitar 401.
   * Sin esto chat-ia-back rechaza con 403 hasta el refresh natural — ver ADR-003.
   */
  const scheduleTokenRefresh = useCallback((user: User) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const freshToken = await user.getIdToken(true)
        // Renovar también la session cookie con el token fresco
        await createSessionCookie(freshToken)
      } catch {
        // Si falla el refresh, el siguiente request recibirá 401 y el guard lo maneja
      }
    }, 55 * 60 * 1000) // 55 minutos
  }, [])

  /**
   * Sincroniza el usuario con el backend y crea la session cookie HttpOnly.
   * Flujo:
   *   1. syncUser (upsert + custom claims — ADR-003)
   *   2. getIdToken(true) — fuerza refresh para incluir los claims recién emitidos
   *   3. createSessionCookie — setea __session HttpOnly (ADR-004)
   *   4. getMe — carga el perfil completo
   *   5. scheduleTokenRefresh — programa el próximo refresh proactivo
   */
  const syncAndLoad = useCallback(async (user: User) => {
    setBusy(true)
    try {
      const token = await user.getIdToken()
      await syncUser(token, refCode)

      // Forzar refresh después de syncUser para incluir custom claims recién emitidos.
      // Sin esto chat-ia-back rechaza con 403 hasta el refresh natural (ADR-003).
      const freshToken = await user.getIdToken(true)

      // Crear session cookie HttpOnly con el token fresco que ya tiene los claims
      await createSessionCookie(freshToken)

      const me = await getMe(freshToken)
      setProfile(me)
      scheduleTokenRefresh(user)
    } catch (err) {
      if (err instanceof AppError && err.code === 'AUTH') {
        await signOut(auth)
      }
    } finally {
      setBusy(false)
    }
  }, [refCode, scheduleTokenRefresh])

  // Escuchar cambios de estado de Firebase auth
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

  /**
   * Recarga el perfil desde el backend sin re-sincronizar con Firebase.
   * Útil después de cambios de organización o actualización de datos.
   */
  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return
    setBusy(true)
    try {
      const token = await firebaseUser.getIdToken()
      const me    = await getMe(token)
      setProfile(me)
    } finally {
      setBusy(false)
    }
  }, [firebaseUser])

  /**
   * Logout completo:
   *   1. deleteSessionCookie — revoca tokens en Firebase + limpia __session (ADR-004)
   *   2. signOut de Firebase — limpia el estado local del SDK
   *   3. Redirect a home
   */
  const logout = useCallback(async () => {
    setBusy(true)
    try {
      // Revocar server-side primero — si falla, continuamos igual
      await deleteSessionCookie()
      await signOut(auth)
      setProfile(null)
      router.push('/')
    } finally {
      setBusy(false)
    }
  }, [router])

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      profile,
      loading,
      busy,
      refreshProfile,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
