'use client'
/**
 * Step-up: las acciones sensibles (secretos, webhooks) exigen re-autenticación reciente.
 * El back responde 403 con `error.data.appCode === 'REAUTH_REQUIRED'`; este hook pide confirmar la identidad
 * al proveedor (popup), renueva la cookie y reintenta la acción UNA vez.
 */
import { useCallback } from 'react'
import { useAuth } from '@/context/auth-context'

function needsReauth(err: unknown): boolean {
  return (err as { data?: { appCode?: string } } | null)?.data?.appCode === 'REAUTH_REQUIRED'
}

export function useStepUp() {
  const { reauthenticate } = useAuth()

  return useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run()
    } catch (err) {
      if (!needsReauth(err)) throw err
      await reauthenticate()
      return run()
    }
  }, [reauthenticate])
}
