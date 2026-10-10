'use client'
/**
 * webhooks-section.tsx — avisos automáticos hacia sistemas externos del dueño.
 *
 * Cada webhook tiene un secreto de firma (HMAC) que el servidor genera y muestra UNA sola vez, al crear o
 * rotar. El receptor lo usa para verificar el header X-Webhook-Signature. Crear, rotar y eliminar piden
 * confirmar la identidad (step-up).
 */
import { useState }                   from 'react'
import { Activity, Loader2, Plus, RotateCw, Send, Trash2, TriangleAlert, Webhook } from 'lucide-react'
import { Badge, Button, Input }       from '@real/ui'
import {
  useWebhooks, useCreateWebhook, useDeleteWebhook, useRotateWebhookSecret, useTestWebhook, useWebhookLogs,
} from '@/hooks/use-config'
import { useStepUp }                  from '@/hooks/use-step-up'
import { getErrorMessage }            from '@/lib/errors'
import { RevealSecretDialog }         from '@/components/config/reveal-secret-dialog'

const when = (d: string | Date | null) => (d ? new Date(d).toLocaleString() : '—')

function Deliveries({ webhookId }: { webhookId: string }) {
  const { data: logs, isLoading, error, refetch, isFetching } = useWebhookLogs(webhookId)
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Últimas entregas</p>
        <Button size="sm" variant="ghost" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Actualizar'}
        </Button>
      </div>
      {isLoading && <div className="h-8 animate-pulse rounded bg-muted" />}
      {error && <p role="alert" className="text-xs text-destructive">{getErrorMessage(error)}</p>}
      {logs && logs.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hubo entregas.</p>}
      {logs?.map(l => (
        <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Badge variant={l.success ? 'secondary' : 'destructive'}>{l.success ? 'OK' : 'Falló'}</Badge>
          <span className="font-mono">{l.event}</span>
          <span>{l.statusCode ?? 'sin respuesta'}</span>
          <span className="text-muted-foreground">{l.duration != null ? l.duration + ' ms' : ''} · intento {l.attempt}</span>
          <span className="text-muted-foreground">{when(l.createdAt)}</span>
          {l.error && <span className="w-full text-destructive">{l.error}</span>}
        </div>
      ))}
    </div>
  )
}

export function WebhooksSection() {
  const { data: webhooks, isLoading, error } = useWebhooks()
  const createWebhook = useCreateWebhook()
  const deleteWebhook = useDeleteWebhook()
  const rotateSecret  = useRotateWebhookSecret()
  const testWebhook   = useTestWebhook()
  const stepUp        = useStepUp()

  const [creating, setCreating] = useState(false)
  const [url,      setUrl]      = useState('')
  const [events,   setEvents]   = useState('*')
  const [desc,     setDesc]     = useState('')

  const [revealed,  setRevealed]  = useState<{ title: string; secret: string } | null>(null)
  const [logsOpen,  setLogsOpen]  = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [message,   setMessage]   = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const busy = createWebhook.isPending || deleteWebhook.isPending || rotateSecret.isPending

  const fail = (err: unknown, fallback: string) => setMessage({ kind: 'error', text: getErrorMessage(err, fallback) })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    const list = events.split(',').map(s => s.trim()).filter(Boolean)
    try {
      const res = await stepUp(() => createWebhook.mutateAsync({ url: url.trim(), events: list, ...(desc ? { description: desc } : {}) }))
      setRevealed({ title: 'Secreto de firma del webhook', secret: res.secret })
      setUrl(''); setEvents('*'); setDesc(''); setCreating(false)
    } catch (err) { fail(err, 'No pudimos crear el webhook.') }
  }

  const handleRotate = async (webhookId: string) => {
    setMessage(null)
    try {
      const res = await stepUp(() => rotateSecret.mutateAsync({ webhookId }))
      setRevealed({ title: 'Nuevo secreto de firma', secret: res.secret })
    } catch (err) { fail(err, 'No pudimos rotar el secreto.') }
  }

  const handleDelete = async (webhookId: string) => {
    setMessage(null); setConfirmId(null)
    try {
      await stepUp(() => deleteWebhook.mutateAsync({ webhookId }))
      setMessage({ kind: 'ok', text: 'Webhook eliminado.' })
    } catch (err) { fail(err, 'No pudimos eliminar el webhook.') }
  }

  const handleTest = async (webhookId: string) => {
    setMessage(null)
    try {
      await testWebhook.mutateAsync({ webhookId })
      setLogsOpen(webhookId)
      setMessage({ kind: 'ok', text: 'Evento de prueba enviado. El resultado aparece en "Últimas entregas".' })
    } catch (err) { fail(err, 'No pudimos enviar la prueba.') }
  }

  return (
    <section className="space-y-3" aria-labelledby="webhooks-title">
      <RevealSecretDialog title={revealed?.title ?? ''} secret={revealed?.secret ?? null} onClose={() => setRevealed(null)} />

      <div className="flex items-center justify-between">
        <h2 id="webhooks-title" className="flex items-center gap-2 text-lg font-medium">
          <Webhook className="h-4 w-4 text-muted-foreground" /> Webhooks
        </h2>
        {!creating && (
          <Button size="sm" onClick={() => { setCreating(true); setMessage(null) }}>
            <Plus className="mr-1 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
           className={'text-sm ' + (message.kind === 'error' ? 'text-destructive' : 'text-green-600')}>
          {message.text}
        </p>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="space-y-2 rounded-lg border p-4">
          <Input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://tu-sistema.com/webhooks" required maxLength={2048} />
          <Input value={events} onChange={e => setEvents(e.target.value)} placeholder="Eventos separados por coma (* = todos)" required />
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)" maxLength={200} />
          <p className="text-xs text-muted-foreground">
            Debe ser una URL pública con https. Al guardar vas a ver el secreto de firma una sola vez.
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !url}>
              {createWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {isLoading && <div className="h-16 animate-pulse rounded-lg bg-muted" />}
      {error && <p role="alert" className="text-sm text-destructive">{getErrorMessage(error, 'No pudimos cargar los webhooks.')}</p>}
      {webhooks && webhooks.length === 0 && !creating && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Todavía no configuraste ningún webhook.
        </p>
      )}

      {webhooks?.map(wh => (
        <div key={wh.id} className="space-y-2 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="truncate font-mono text-sm">{wh.url}</p>
              <div className="flex flex-wrap items-center gap-1">
                {wh.events.map(ev => <Badge key={ev} variant="secondary">{ev}</Badge>)}
              </div>
              <p className="text-xs text-muted-foreground">
                Firma: whsec_••••{wh.secretHint || '????'} · Último envío: {when(wh.lastTriggeredAt)}
                {wh.description ? ' · ' + wh.description : ''}
              </p>
              {!wh.secretHint && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <TriangleAlert className="h-3 w-3" /> Sin clave de firma: rotala para poder enviar eventos.
                </p>
              )}
              {wh.failureCount > 0 && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <TriangleAlert className="h-3 w-3" /> {wh.failureCount} {wh.failureCount === 1 ? 'entrega fallida' : 'entregas fallidas'} seguidas
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" aria-label="Enviar evento de prueba" disabled={testWebhook.isPending}
                      onClick={() => void handleTest(wh.id)}><Send className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Ver entregas"
                      onClick={() => setLogsOpen(logsOpen === wh.id ? null : wh.id)}><Activity className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Rotar secreto de firma" disabled={busy}
                      onClick={() => void handleRotate(wh.id)}><RotateCw className="h-4 w-4" /></Button>
              {confirmId === wh.id ? (
                <>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => void handleDelete(wh.id)}>Confirmar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>No</Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" aria-label="Eliminar webhook" disabled={busy} onClick={() => setConfirmId(wh.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
          {logsOpen === wh.id && <Deliveries webhookId={wh.id} />}
        </div>
      ))}
    </section>
  )
}
