'use client'
/**
 * components/desktop/desktop-guard.tsx — solo actúa dentro de la app de escritorio (ADR-023); en un navegador común no renderiza nada.
 *
 *   · Política de versiones (DT-DESK-11): si la versión instalada está bloqueada o por debajo de la mínima soportada, tapa el panel
 *     con un aviso de actualización. Es el "rollback" posible con un updater que solo sube de versión.
 *   · Telemetría CON CONSENTIMIENTO (DT-DESK-13): se pregunta una vez; sin "Aceptar" no se envía nada. Con consentimiento se manda
 *     la versión y el sistema operativo al abrir, y los errores no controlados del panel. Nunca datos de la persona ni de su negocio.
 */
import { useEffect, useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from '@real/ui'
import { trpc } from '@/lib/trpc/client'
import {
  detectOs, evaluateVersion, getDesktopBridge, readConsent, writeConsent,
  type Consent, type DesktopBridge,
} from '@/lib/desktop'

export function DesktopGuard() {
  const [bridge, setBridge]   = useState<DesktopBridge | null>(null)
  const [consent, setConsent] = useState<Consent>(null)
  const pinged = useRef(false)

  // El puente lo inyecta la app; en un navegador común queda null y todo lo de abajo no hace nada.
  useEffect(() => {
    setBridge(getDesktopBridge())
    setConsent(readConsent(window.localStorage))
  }, [])

  const policy    = trpc.desktop.policy.useQuery(undefined, { enabled: bridge !== null, retry: false, staleTime: 5 * 60_000 })
  const telemetry = trpc.desktop.telemetry.useMutation()
  const send = telemetry.mutate

  // Versión instalada + sistema operativo, una vez por apertura y solo con consentimiento.
  useEffect(() => {
    if (!bridge || consent !== 'granted' || pinged.current || !bridge.version) return
    pinged.current = true
    send({ kind: 'ping', version: bridge.version, os: detectOs(navigator.userAgent) })
  }, [bridge, consent, send])

  // Errores no controlados del panel dentro de la app (sin stack ni datos: solo el mensaje, recortado).
  useEffect(() => {
    if (!bridge || consent !== 'granted' || !bridge.version) return
    const report = (message: string) =>
      send({ kind: 'error', version: bridge.version, os: detectOs(navigator.userAgent), message })
    const onError = (e: ErrorEvent) => report(e.message || 'error')
    const onRejection = (e: PromiseRejectionEvent) => report(e.reason instanceof Error ? e.reason.message : 'promesa rechazada')
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [bridge, consent, send])

  if (!bridge) return null

  const verdict = evaluateVersion(bridge.version, policy.data)
  if (verdict !== 'ok') {
    return (
      <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
        <div className="max-w-sm text-center space-y-4">
          <CircleAlert className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">
            {verdict === 'blocked' ? 'Esta versión tiene un problema' : 'Hay una versión nueva'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {verdict === 'blocked'
              ? 'Corregimos un error en una versión más nueva. Instalala para seguir usando el panel.'
              : 'Esta versión de la aplicación ya no es compatible. Instalá la nueva para seguir usando el panel.'}
          </p>
          {policy.data?.downloadUrl && (
            <Button asChild className="min-h-11">
              <a href={policy.data.downloadUrl} target="_blank" rel="noreferrer">Descargar la versión nueva</a>
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Versión instalada: {bridge.version}</p>
        </div>
      </div>
    )
  }

  if (consent === null) {
    const answer = (value: 'granted' | 'denied') => { writeConsent(window.localStorage, value); setConsent(value) }
    return (
      <div role="dialog" aria-label="Ayudanos a mejorar la aplicación"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[90] rounded-lg border bg-card p-4 shadow-lg space-y-3">
        <p className="text-sm font-medium">¿Nos ayudás a mejorar la aplicación?</p>
        <p className="text-xs text-muted-foreground">
          Si aceptás, enviamos la versión instalada, tu sistema operativo y los errores que ocurran en el panel.
          Nunca enviamos datos tuyos ni de tu negocio. Podés cambiarlo cuando quieras.
        </p>
        <div className="flex gap-2">
          <Button className="min-h-11 flex-1" onClick={() => answer('granted')}>Aceptar</Button>
          <Button className="min-h-11 flex-1" variant="outline" onClick={() => answer('denied')}>No, gracias</Button>
        </div>
      </div>
    )
  }

  return null
}
