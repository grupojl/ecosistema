'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { auth, onAuthStateChanged, signOut, type User } from '@/lib/firebase'
import { syncUser, getMe } from '@/lib/api'
import { AppError } from '@/lib/errors'
import type { UserProfile } from '@/lib/types'

interface AuthContextValue {
  firebaseUser:    User | null
  profile:         UserProfile | null
  loading:         boolean
  busy:            boolean
  refreshProfile:  () => Promise<void>
  logout:          () => Promise<void>
}

const defaultValue: AuthContextValue = {
  firebaseUser:   null,
  profile:        null,
  loading:        true,
  busy:           false,
  refreshProfile: async () => {},
  logout:         async () => {},
}

const AuthContext = createContext<AuthContextValue>(defaultValue)

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

interface AuthProviderProps {
  children: ReactNode
  refCode?: string
}

export function AuthProvider({ children, refCode }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile]           = useState<UserProfile | null>(null)
  const [loading, setLoading]           = useState(true)
  const [busy, setBusy]                 = useState(false)
  const router                          = useRouter()

  // Ref para el timer de refresh proactivo (antes de los 55 min de expiración)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Programa el refresh del token 55 minutos después de la última sincronización.
   * Firebase tokens expiran a los 60 min; los refrescamos 5 min antes para evitar 401.
   */
  const scheduleTokenRefresh = useCallback((user: User) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)

    refreshTimerRef.current = setTimeout(async () => {
      try {
        await user.getIdToken(true) // forceRefresh
      } catch {
        // Si el refresh falla (sesión revocada), Firebase disparará onAuthStateChanged
        // con null y el usuario será deslogueado automáticamente
      }
    }, 55 * 60 * 1000) // 55 minutos
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const res = await getMe()
      setProfile(res.data)
    } catch (err) {
      if (err instanceof AppError && err.code === 'AUTH') {
        setProfile(null)
        router.push('/')
      } else {
        setProfile(null)
      }
    }
  }, [router])

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    await signOut()
    setProfile(null)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)

      if (user) {
        setBusy(true)
        scheduleTokenRefresh(user)

        try {
          const res = await syncUser(refCode)
          setProfile(res.data)
        } catch (err) {
          // Si el backend falla, intentar getMe como fallback
          try {
            await refreshProfile()
          } catch {
            setProfile(null)
          }
        } finally {
          setBusy(false)
        }
      } else {
        // Usuario no autenticado — limpiar estado
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        setProfile(null)
      }

      setLoading(false)
    })

    return () => {
      unsubscribe()
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [refCode, refreshProfile, scheduleTokenRefresh])

  return (
    <AuthContext.Provider
      value={{ firebaseUser, profile, loading, busy, refreshProfile, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}
