// features/whatsapp/hooks.ts
//
// WhatsApp de la organización (ADR-025). Habla con sass-back por tRPC (`whatsapp.*`, opción B): los tipos salen del
// contrato (ADR-019), no se escriben a mano. sass-back reenvía a chatia; al navegador nunca llega un token de Meta.
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { inferRouterOutputs } from '@trpc/server'
import { trpc } from '@/lib/trpc/client'
import type { AppRouter } from '@/lib/trpc/router-type'
import { useStepUp } from '@/hooks/use-step-up'
import { launchEmbeddedSignup } from '@/features/whatsapp/embedded-signup'

export type WhatsappConnection = NonNullable<inferRouterOutputs<AppRouter>['whatsapp']['status']>

const STATUS_KEY = [['whatsapp', 'status']]

export function useWhatsappConnection() {
  return trpc.whatsapp.status.useQuery(undefined, { retry: false })
}

/** Ejecuta una acción de punta a punta con su propio pending/error, sin dejar rechazos sin atrapar. */
function useAction<A extends unknown[]>(run: (...args: A) => Promise<unknown>) {
  const qc = useQueryClient()
  const [isPending, setPending] = useState(false)
  const [error, setError]       = useState<unknown>(null)

  const start = useCallback(async (...args: A): Promise<boolean> => {
    setPending(true)
    setError(null)
    try {
      await run(...args)
      await qc.invalidateQueries({ queryKey: STATUS_KEY })
      return true
    } catch (e) {
      setError(e)
      return false
    } finally {
      setPending(false)
    }
  }, [run, qc])

  return { start, isPending, error }
}

// Conectar y desconectar son acciones sensibles: piden confirmar la identidad (step-up), igual que los secretos.
export function useConnectWhatsapp() {
  const stepUp  = useStepUp()
  const connect = trpc.whatsapp.connect.useMutation()
  // El popup de Meta se abre una sola vez; solo el envío al back se reintenta tras el step-up.
  const run = useCallback(async () => {
    const signup = await launchEmbeddedSignup()
    return stepUp(() => connect.mutateAsync(signup))
  }, [stepUp, connect])
  return useAction(run)
}

export function useDisconnectWhatsapp() {
  const stepUp     = useStepUp()
  const disconnect = trpc.whatsapp.disconnect.useMutation()
  const run = useCallback(
    (accountId: string) => stepUp(() => disconnect.mutateAsync({ accountId })),
    [stepUp, disconnect],
  )
  return useAction(run)
}
