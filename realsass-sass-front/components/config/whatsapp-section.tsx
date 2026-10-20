'use client'
/**
 * whatsapp-section.tsx — conectar el WhatsApp de la organización (ADR-025).
 *
 * El dueño autoriza el WhatsApp de SU negocio con Embedded Signup de Meta; la cuenta y el gasto son suyos.
 * Al back solo viaja el `code` del flujo: los tokens y el App Secret nunca llegan al navegador.
 * Conectar y desconectar piden confirmar la identidad (step-up), como los secretos.
 */
import { CircleAlert, Loader2, MessageCircle } from 'lucide-react'
import { Badge, Button, Skeleton } from '@real/ui'
import {
  useWhatsappConnection, useConnectWhatsapp, useDisconnectWhatsapp,
} from '@/features/whatsapp'
import { getEmbeddedSignupConfig } from '@/features/whatsapp/embedded-signup'
import { getErrorMessage } from '@/lib/errors'

const STATUS_LABEL = { CONNECTED: 'Conectado', PENDING: 'Pendiente', ERROR: 'Con error' } as const
const STATUS_VARIANT = { CONNECTED: 'default', PENDING: 'secondary', ERROR: 'destructive' } as const

export function WhatsappSection() {
  const { data: conn, isLoading, error, refetch } = useWhatsappConnection()
  const connect    = useConnectWhatsapp()
  const disconnect = useDisconnectWhatsapp()
  const configured = getEmbeddedSignupConfig() !== null
  const actionError = connect.error ?? disconnect.error

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium flex items-center gap-2">
        <MessageCircle className="h-5 w-5" /> WhatsApp
      </h2>
      <p className="text-sm text-muted-foreground">
        Conectá el WhatsApp de tu negocio para que el asistente atienda a tus clientes. La cuenta y el gasto en Meta son tuyos.
      </p>

      {isLoading ? (
        <Skeleton className="h-20 rounded-lg" />
      ) : error ? (
        <div role="alert" className="flex items-center gap-2 text-destructive p-4 rounded-lg border border-destructive/20 bg-destructive/5">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <p className="text-sm flex-1">{getErrorMessage(error)}</p>
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => refetch()}>Reintentar</Button>
        </div>
      ) : conn ? (
        <div className="p-4 rounded-lg border space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm">{conn.displayPhone ?? 'Número sin identificar'}</span>
            <Badge variant={STATUS_VARIANT[conn.status]}>{STATUS_LABEL[conn.status]}</Badge>
          </div>
          {conn.status === 'ERROR' && conn.errorMessage && (
            <p className="text-sm text-destructive">{conn.errorMessage}</p>
          )}
          <Button variant="outline" className="min-h-11" disabled={disconnect.isPending}
            onClick={() => void disconnect.start(conn.accountId)}>
            {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-dashed space-y-3">
          <p className="text-sm">Todavía no conectaste un WhatsApp.</p>
          <Button className="min-h-11" disabled={!configured || connect.isPending}
            onClick={() => void connect.start()}>
            {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Conectar WhatsApp
          </Button>
          {!configured && (
            <p className="text-xs text-muted-foreground">
              Falta configurar la app de Meta (NEXT_PUBLIC_META_APP_ID / NEXT_PUBLIC_META_CONFIG_ID).
            </p>
          )}
        </div>
      )}

      {actionError != null && (
        <p role="alert" className="text-sm text-destructive">{getErrorMessage(actionError)}</p>
      )}
    </section>
  )
}
