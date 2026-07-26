// hooks/use-dashboard-sso.ts
'use client'

import { useState, useCallback } from 'react'

const SASS_BACK_URL: string =
  (process.env.NEXT_PUBLIC_SASS_BACK_URL ?? 'http://localhost:3004')
    .replace(/\/+$/, '')

const DASHBOARD_FRONT_URL: string =
  (process.env.NEXT_PUBLIC_DASHBOARD_FRONT_URL ?? 'http://localhost:3002')
    .replace(/\/+$/, '')

export type SsoState = 'idle' | 'loading' | 'success' | 'error'

export function useDashboardSSO(
  getIdToken: () => Promise<string | null | undefined>,
) {
  const [state,    setState]    = useState<SsoState>('idle')
  const [ssoError, setSsoError] = useState<string | null>(null)

  const openDashboard = useCallback(async () => {
    setState('loading')
    setSsoError(null)

    try {
      const firebaseToken = await getIdToken()
      if (!firebaseToken) throw new Error('No se pudo obtener el token de sesión')

      // 1. Mandar el idToken al sass-back para obtener un customToken
      const res = await fetch(`${SASS_BACK_URL}/api/v1/auth/firebase-sso`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ firebaseIdToken: firebaseToken }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(body.message ?? `Error del servidor: ${res.status}`)
      }

      const data = await res.json() as { customToken: string }

      setState('success')

      // 2. Redirigir al dashboard-front con el customToken en la URL
      // El dashboard-front lo lee en /auth/sso y hace signInWithCustomToken
      setTimeout(() => {
        window.location.href =
          `${DASHBOARD_FRONT_URL}/auth/sso?token=${encodeURIComponent(data.customToken)}`
      }, 300)

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al conectar con el dashboard'
      setSsoError(msg)
      setState('error')
      setTimeout(() => { setState('idle'); setSsoError(null) }, 5000)
    }
  }, [getIdToken])

  return { state, ssoError, openDashboard }
}