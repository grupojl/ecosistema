// hooks/use-dashboard-sso.ts
'use client'
/**
 * SSO sass-front → dashboard-front (domain/flows/owner-organizacion.md, Paso 4).
 *
 * Pide al back un custom token Firebase (auth.createDashboardSso, tRPC) y navega al dashboard con él.
 * La identidad sale de la cookie de sesión: ya no se reenvía un idToken ni se llama a un endpoint REST.
 * Los orígenes del sass-front y del dashboard son distintos, por eso no comparten la sesión de Firebase.
 */
import { useState, useCallback } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useAuth } from '@/context/auth-context'
import { getErrorMessage } from '@/lib/errors'

const DASHBOARD_FRONT_URL: string =
  (process.env.NEXT_PUBLIC_DASHBOARD_FRONT_URL ?? '').replace(/\/+$/, '')

export type SsoState = 'idle' | 'loading' | 'success' | 'error'

export function useDashboardSSO() {
  const { sessionReady } = useAuth()
  const createSso = trpc.auth.createDashboardSso.useMutation()

  const [state,    setState]    = useState<SsoState>('idle')
  const [ssoError, setSsoError] = useState<string | null>(null)

  const fail = useCallback((message: string) => {
    setSsoError(message)
    setState('error')
    setTimeout(() => { setState('idle'); setSsoError(null) }, 5000)
  }, [])

  const openDashboard = useCallback(async () => {
    if (!DASHBOARD_FRONT_URL) {
      fail('NEXT_PUBLIC_DASHBOARD_FRONT_URL no está configurada.')
      return
    }
    if (!sessionReady) {
      fail('Tu sesión todavía se está preparando. Probá de nuevo en unos segundos.')
      return
    }

    setState('loading')
    setSsoError(null)
    try {
      const { customToken } = await createSso.mutateAsync()
      setState('success')
      setTimeout(() => {
        window.location.href = `${DASHBOARD_FRONT_URL}/auth/sso?token=${encodeURIComponent(customToken)}`
      }, 300)
    } catch (e: unknown) {
      fail(getErrorMessage(e, 'Error al conectar con el dashboard'))
    }
  }, [createSso, fail, sessionReady])

  return { state, ssoError, openDashboard }
}
