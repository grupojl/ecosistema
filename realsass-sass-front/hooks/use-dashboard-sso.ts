// hooks/use-dashboard-sso.ts
'use client'
/**
 * SSO sass-front → dashboard-front (domain/flows/owner-organizacion.md, Paso 4).
 *
 * Pide al back un custom token Firebase (auth.createDashboardSso, tRPC) y abre el dashboard con él en una pestaña nueva.
 * La identidad sale de la cookie de sesión: ya no se reenvía un idToken ni se llama a un endpoint REST.
 * Los orígenes del sass-front y del dashboard son distintos, por eso no comparten la sesión de Firebase.
 */
import { useState, useCallback, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useAuth } from '@/context/auth-context'
import { getErrorMessage } from '@/lib/errors'

const DASHBOARD_FRONT_URL: string =
  (process.env.NEXT_PUBLIC_DASHBOARD_FRONT_URL ?? '').replace(/\/+$/, '')

export type SsoState = 'idle' | 'loading' | 'success' | 'error'

export function useDashboardSSO() {
  const { sessionReady } = useAuth()
  const readyRef = useRef(sessionReady)
  readyRef.current = sessionReady
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
    // La pestaña se abre ACÁ, dentro del click: si se abriera después del await el navegador la bloquearía
    // como popup. Se le carga la URL cuando llega el token. Sin `noopener` en el open (necesitamos la referencia);
    // se corta el vínculo con `opener` a mano.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null

    setState('loading')
    setSsoError(null)
    try {
      // Justo después de un F5 la sesión puede estar terminando de prepararse: se espera (hasta 8 s) en vez de fallar.
      for (let i = 0; i < 80 && !readyRef.current; i++) await new Promise((r) => setTimeout(r, 100))
      if (!readyRef.current) throw new Error('Tu sesión todavía se está preparando. Probá de nuevo en unos segundos.')

      const { customToken } = await createSso.mutateAsync()
      const url = `${DASHBOARD_FRONT_URL}/auth/sso?token=${encodeURIComponent(customToken)}`
      setState('success')
      setTimeout(() => {
        if (tab && !tab.closed) tab.location.href = url
        else window.location.href = url // popup bloqueado o cerrado: se navega en esta pestaña
        setState('idle')
      }, 300)
    } catch (e: unknown) {
      tab?.close()
      fail(getErrorMessage(e, 'Error al conectar con el dashboard'))
    }
  }, [createSso, fail])

  return { state, ssoError, openDashboard }
}
