'use client'
/**
 * secrets-section.tsx — claves sensibles de la organización (tokens de APIs externas, pasarelas…).
 *
 * domain/flows/owner-organizacion.md, Paso 3 (Secretos) e invariante: "los secretos nunca viajan al navegador".
 *   · El valor se envía una vez al crear/rotar y el servidor lo guarda cifrado; no vuelve nunca.
 *   · La lista solo trae nombre, pista (últimos 4), destino y fechas.
 *   · Crear, rotar y revocar piden confirmar la identidad (step-up).
 */
import { useState }                       from 'react'
import { KeyRound, Loader2, Plus, RotateCw, Trash2 } from 'lucide-react'
import { Badge, Button, Input, NativeSelect, SectionHeader, Skeleton, Card, EmptyState } from '@real/ui'
import { useSecrets, useCreateSecret, useRotateSecret, useRevokeSecret } from '@/hooks/use-config'
import { useStepUp }                      from '@/hooks/use-step-up'
import { getErrorMessage }                from '@/lib/errors'

const TARGETS = [
  { value: 'all',      label: 'Todos los servicios' },
  { value: 'chat',     label: 'Chat IA' },
  { value: 'payments', label: 'Pagos' },
  { value: 'ads',      label: 'Campañas' },
] as const
type Target = typeof TARGETS[number]['value']

const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString() : null)

export function SecretsSection() {
  const { data: secrets, isLoading, error } = useSecrets()
  const createSecret = useCreateSecret()
  const rotateSecret = useRotateSecret()
  const revokeSecret = useRevokeSecret()
  const stepUp       = useStepUp()

  const [creating, setCreating] = useState(false)
  const [key,      setKey]      = useState('')
  const [value,    setValue]    = useState('')
  const [desc,     setDesc]     = useState('')
  const [target,   setTarget]   = useState<Target>('all')
  const [expires,  setExpires]  = useState('')

  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [newValue,   setNewValue]   = useState('')
  const [confirmId,  setConfirmId]  = useState<string | null>(null)

  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const busy = createSecret.isPending || rotateSecret.isPending || revokeSecret.isPending

  const run = async (action: () => Promise<unknown>, okText: string) => {
    setMessage(null)
    try {
      await stepUp(action)
      setMessage({ kind: 'ok', text: okText })
      return true
    } catch (err) {
      setMessage({ kind: 'error', text: getErrorMessage(err, 'No pudimos completar la acción.') })
      return false
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await run(
      () => createSecret.mutateAsync({
        key, value, ...(desc ? { description: desc } : {}), systemTarget: target,
        ...(expires ? { expiresAt: new Date(expires + 'T23:59:59').toISOString() } : {}),
      }),
      'Clave guardada de forma segura.',
    )
    if (ok) { setKey(''); setValue(''); setDesc(''); setTarget('all'); setExpires(''); setCreating(false) }
    else setValue('') // ante un error no se deja el valor sensible en memoria
  }

  const handleRotate = async (secretId: string) => {
    const ok = await run(() => rotateSecret.mutateAsync({ secretId, value: newValue }), 'Clave rotada.')
    setNewValue('')
    if (ok) setRotatingId(null)
  }

  const handleRevoke = async (secretId: string) => {
    setConfirmId(null)
    await run(() => revokeSecret.mutateAsync({ secretId }), 'Clave revocada.')
  }

  return (
    <section className="space-y-3" aria-labelledby="secrets-title">
      <SectionHeader
        id="secrets-title"
        icon={<KeyRound />}
        title="Claves y secretos"
        actions={!creating && (
          <Button size="sm" onClick={() => { setCreating(true); setMessage(null) }}>
            <Plus className="mr-1 h-4 w-4" /> Nueva clave
          </Button>
        )}
      />
      <p className="text-xs text-muted-foreground">
        Se guardan cifradas y no se pueden volver a ver. Para cambiar una, rotala.
      </p>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
           className={'text-sm ' + (message.kind === 'error' ? 'text-destructive' : 'text-success-ink')}>
          {message.text}
        </p>
      )}

      {creating && (
        <Card className="p-4"><form onSubmit={handleCreate} className="space-y-2" autoComplete="off">
          <Input value={key} onChange={e => setKey(e.target.value)} placeholder="Nombre (ej. STRIPE_SECRET_KEY)"
                 pattern="[A-Za-z][A-Za-z0-9_.\-]{1,99}" title="Letras, números, _ . - (2 a 100 caracteres)" required />
          <Input type="password" value={value} onChange={e => setValue(e.target.value)} placeholder="Valor"
                 autoComplete="new-password" required maxLength={4096} />
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)" maxLength={300} />
          <div className="flex flex-wrap gap-2">
            <NativeSelect value={target} onChange={e => setTarget(e.target.value as Target)} aria-label="Servicio de destino">
              {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </NativeSelect>
            <Input type="date" value={expires} onChange={e => setExpires(e.target.value)} aria-label="Vence (opcional)"
                   className="w-auto" min={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !key || !value}>
              {createSecret.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setCreating(false); setValue('') }}>Cancelar</Button>
          </div>
        </form></Card>
      )}

      {isLoading && <Skeleton className="h-16 rounded-lg" />}
      {error && <EmptyState kind="error" description={getErrorMessage(error, 'No pudimos cargar las claves.')} />}
      {secrets && secrets.length === 0 && !creating && (
        <EmptyState title="Sin claves" description="Todavía no cargaste ninguna clave." />
      )}

      {secrets?.map(s => {
        const expired = s.expiresAt ? new Date(s.expiresAt) < new Date() : false
        return (
          <Card key={s.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium">{s.key}</p>
                <p className="text-xs text-muted-foreground">
                  {s.hint ? '••••' + s.hint : '••••••••'}
                  {s.description ? ' · ' + s.description : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.rotatedAt ? 'Rotada el ' + fmt(s.rotatedAt) : 'Creada el ' + fmt(s.createdAt)}
                  {s.expiresAt && (expired
                    ? <> · <span className="text-destructive">Venció el {fmt(s.expiresAt)}</span></>
                    : <> · Vence el {fmt(s.expiresAt)}</>)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="secondary">{TARGETS.find(t => t.value === s.systemTarget)?.label ?? s.systemTarget}</Badge>
                <Button size="icon" variant="ghost" aria-label={'Rotar ' + s.key} disabled={busy}
                        onClick={() => { setRotatingId(rotatingId === s.id ? null : s.id); setNewValue(''); setMessage(null) }}>
                  <RotateCw className="h-4 w-4" />
                </Button>
                {confirmId === s.id ? (
                  <>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleRevoke(s.id)}>Confirmar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>No</Button>
                  </>
                ) : (
                  <Button size="icon" variant="ghost" aria-label={'Revocar ' + s.key} disabled={busy}
                          onClick={() => setConfirmId(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>

            {rotatingId === s.id && (
              <form className="flex gap-2" autoComplete="off"
                    onSubmit={e => { e.preventDefault(); void handleRotate(s.id) }}>
                <Input type="password" value={newValue} onChange={e => setNewValue(e.target.value)}
                       placeholder="Nuevo valor" autoComplete="new-password" required maxLength={4096} autoFocus />
                <Button type="submit" size="sm" disabled={busy || !newValue}>
                  {rotateSecret.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rotar'}
                </Button>
              </form>
            )}
            {confirmId === s.id && (
              <p className="text-xs text-destructive">
                Los servicios que usan esta clave dejarán de funcionar. Esta acción no se puede deshacer.
              </p>
            )}
          </Card>
        )
      })}
    </section>
  )
}
