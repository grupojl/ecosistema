'use client'

import { useState } from 'react'
import { Bell, CircleCheck, Package, TriangleAlert, Trash2 } from 'lucide-react'
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, SectionHeader, SegmentedControl,
  Avatar, AvatarFallback, Progress, EmptyState,
} from '@/components/ui'

interface Notice { id: number; day: 'Hoy' | 'Ayer'; icon: typeof Bell; title: string; text: string; read: boolean }
const SEED: Notice[] = [
  { id: 1, day: 'Hoy', icon: Package, title: 'Nuevo pedido #1043', text: 'Lucía Pérez · $ 18.400', read: false },
  { id: 2, day: 'Hoy', icon: TriangleAlert, title: 'Stock bajo', text: 'Camiseta Essential: quedan 3 unidades.', read: false },
  { id: 3, day: 'Ayer', icon: CircleCheck, title: 'Pago acreditado', text: 'Pedido #1039 · $ 31.200', read: true },
]

export function NotificationCenter() {
  const [items, setItems] = useState(SEED)
  const [tab, setTab] = useState<'todas' | 'sin-leer'>('todas')
  const [pct, setPct] = useState(0)
  const unread = items.filter((n) => !n.read).length
  const shown = items.filter((n) => tab === 'todas' || !n.read)

  const upload = () => {
    setPct(1)
    const t = setInterval(() => setPct((p) => { if (p >= 100) { clearInterval(t); return 100 } return Math.min(100, p + 12) }), 300)
  }

  return (
    <section className="space-y-6">
      <SectionHeader title="Badges, contadores y centro de notificaciones" description="El color nunca va solo: lleva texto o un nombre accesible. Los contadores pasan de 9 a «9+». Toca la campana: abre el centro de notificaciones." />
      <div className="flex flex-wrap items-center gap-3">
        <Badge>Nuevo</Badge><Badge variant="secondary">Borrador</Badge><Badge variant="outline">v2.4</Badge>
        <Badge variant="success" dot>Pagado</Badge><Badge variant="warning" dot>Pendiente</Badge><Badge variant="destructive" dot>Rechazado</Badge>
        <span className="inline-flex items-center gap-2 text-sm"><Avatar className="size-8"><AvatarFallback>AL</AvatarFallback></Avatar><span className="size-2 rounded-full bg-success" aria-hidden="true" /> En línea</span>
        <span className="inline-flex items-center gap-2 text-sm"><Avatar className="size-8"><AvatarFallback>MR</AvatarFallback></Avatar><span className="size-2 rounded-full bg-warning" aria-hidden="true" /> Ausente</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="relative" aria-label={`Notificaciones, ${unread} sin leer`}>
              <Bell />
              {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
            </Button>
          </DialogTrigger>
          <DialogContent preset="detail">
            <DialogHeader>
              <DialogTitle>Notificaciones</DialogTitle>
              <DialogDescription>Historial de lo que pasó mientras no mirabas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-6 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SegmentedControl aria-label="Filtro" value={tab} onValueChange={setTab} options={[{ value: 'todas', label: 'Todas' }, { value: 'sin-leer', label: 'Sin leer' }]} />
                <Button size="sm" variant="ghost" onClick={() => setItems((l) => l.map((n) => ({ ...n, read: true })))}>Marcar todo</Button>
              </div>
              {shown.length === 0 ? <EmptyState title="Todo al día" description="No hay notificaciones sin leer." /> : (['Hoy', 'Ayer'] as const).map((day) => {
                const list = shown.filter((n) => n.day === day)
                return list.length === 0 ? null : (
                  <div key={day}>
                    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{day}</h3>
                    <ul className="space-y-1">
                      {list.map((n) => (
                        <li key={n.id} className="flex items-start rounded-lg hover:bg-muted/60">
                          <button type="button" className="flex min-h-11 flex-1 items-start gap-3 p-3 text-left" onClick={() => setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}>
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><n.icon className="size-4" aria-hidden="true" /></span>
                            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n.title}</span><span className="block text-xs text-muted-foreground">{n.text}</span></span>
                            {!n.read && <><span className="mt-2 size-2 rounded-full bg-primary" aria-hidden="true" /><span className="sr-only">Sin leer</span></>}
                          </button>
                          <Button size="icon" variant="ghost" aria-label={`Eliminar: ${n.title}`} onClick={() => setItems((l) => l.filter((x) => x.id !== n.id))}><Trash2 /></Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>
        <Button size="sm" variant="outline" onClick={() => setItems((l) => [{ id: Date.now(), day: 'Hoy', icon: Package, title: 'Nuevo pedido', text: 'Simulado ahora mismo', read: false }, ...l])}>Simular aviso</Button>
        <Button size="sm" variant="ghost" onClick={() => setItems(SEED)}>Restablecer</Button>
      </div>

      <div className="max-w-md space-y-2">
        <p className="text-sm font-medium">Progreso <span className="text-muted-foreground tabular-nums">{pct}%</span></p>
        <Progress value={pct} aria-label="Subir imágenes" />
        <Button size="sm" variant="outline" onClick={upload}>Simular subida</Button>
      </div>
    </section>
  )
}
