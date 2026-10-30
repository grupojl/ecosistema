'use client'

import { useState } from 'react'
import { Button, Field, Input, NativeSelect, SectionHeader, Switch, Label , toast } from '@/components/ui'

type Kind = 'success' | 'info' | 'warning' | 'error' | 'loading'
const DEFAULTS: Record<Kind, string> = { success: 'Pedido guardado', info: 'Nueva versión disponible', warning: 'Conexión inestable', error: 'No pudimos guardar', loading: 'Guardando…' }

export function ToastLab() {
  const [kind, setKind] = useState<Kind>('success')
  const [title, setTitle] = useState('Producto archivado')
  const [desc, setDesc] = useState('SKU-00421 ya no se muestra en la tienda.')
  const [seconds, setSeconds] = useState('4500')
  const [withAction, setWithAction] = useState(true)
  const [persistent, setPersistent] = useState(false)

  const show = () => {
    const opts = {
      description: desc || undefined,
      duration: persistent ? Infinity : withAction ? Number(seconds) * 2 : Number(seconds),
      action: withAction ? { label: 'Deshacer', onClick: () => toast.success('Cambio deshecho') } : undefined,
    }
    if (kind === 'loading') {
      const id = toast.loading(title, { description: opts.description })
      setTimeout(() => toast.success('Listo', { id, description: undefined }), 1800)
    } else toast[kind](title, opts)
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Toasts"
        description="Confirman lo que ya pasó, no piden nada. Se pausan al apuntarlos, se descartan deslizando o con Esc, y nunca se pierden: los repetidos se agrupan y, si hay muchos, esperan en cola."
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => toast.success('Pedido guardado')}>Éxito</Button>
        <Button variant="outline" onClick={() => toast.info('Nueva versión disponible')}>Información</Button>
        <Button variant="outline" onClick={() => toast.warning('Conexión inestable')}>Aviso</Button>
        <Button variant="outline" onClick={() => toast.error('No pudimos guardar')}>Error</Button>
        <Button variant="outline" onClick={() => { const id = toast.loading('Subiendo…'); setTimeout(() => toast.success('Listo', { id }), 1800) }}>Cargando → listo</Button>
        <Button variant="outline" onClick={() => toast('Se guardó sin conexión', { duration: Infinity })}>Persistente</Button>
        <Button variant="outline" onClick={() => { toast('Aviso 1'); toast('Aviso 2'); toast('Aviso 3') }}>Apilar tres</Button>
        <Button variant="outline" onClick={() => { for (let i = 0; i < 8; i++) toast(`Aviso ${i + 1}`) }}>Saturar la cola</Button>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-medium">Probador</h3>
        <div className="grid gap-4 medium:grid-cols-2">
          <Field id="tl-kind" label="Tipo">{() => (
            <NativeSelect id="tl-kind" value={kind} onChange={(e) => { const k = e.target.value as Kind; setKind(k); setTitle(DEFAULTS[k]) }}>
              <option value="success">Éxito</option><option value="info">Información</option><option value="warning">Aviso</option><option value="error">Error</option><option value="loading">Cargando</option>
            </NativeSelect>
          )}</Field>
          <Field id="tl-title" label="Título" hint="Qué pasó, en menos de 40 caracteres.">{() => <Input id="tl-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />}</Field>
          <Field id="tl-desc" label="Descripción (opcional)">{() => <Input id="tl-desc" value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
          <Field id="tl-dur" label="Duración" hint="Con acción dura el doble.">{() => (
            <NativeSelect id="tl-dur" value={seconds} onChange={(e) => setSeconds(e.target.value)}>
              <option value="3000">3 s</option><option value="4500">4,5 s</option><option value="8000">8 s</option><option value="12000">12 s</option>
            </NativeSelect>
          )}</Field>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Label className="flex min-h-11 items-center gap-2"><Switch checked={withAction} onCheckedChange={setWithAction} /> Con acción «Deshacer»</Label>
          <Label className="flex min-h-11 items-center gap-2"><Switch checked={persistent} onCheckedChange={setPersistent} /> Persistente</Label>
          <Button onClick={show}>Mostrar toast</Button>
        </div>
      </div>
    </section>
  )
}
