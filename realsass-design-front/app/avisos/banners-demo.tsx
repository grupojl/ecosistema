'use client'

import { useState } from 'react'
import { Clock, Wrench, WifiOff, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle, Button, SectionHeader } from '@/components/ui'

const BANNERS = [
  { id: 'trial', icon: Clock, text: 'Prueba gratis: te quedan 9 días.', action: 'Ver planes', dismissible: true },
  { id: 'maint', icon: Wrench, text: 'Mantenimiento programado el sábado de 2:00 a 3:00. Los pagos estarán en pausa.', dismissible: true },
  { id: 'offline', icon: WifiOff, text: 'Sin conexión. Tus cambios se guardan en el dispositivo y se envían al reconectar.', dismissible: false },
] as const

const ALERTS = [
  { id: 'a1', variant: 'info', title: 'Nueva versión del catálogo', text: 'Importamos 12 productos desde tu hoja de cálculo.', action: null },
  { id: 'a2', variant: 'success', title: 'Dominio verificado', text: 'Tu tienda ya responde en mitienda.com.', action: null },
  { id: 'a3', variant: 'warning', title: 'Tu plan vence en 3 días', text: 'Renueva para no perder el acceso al panel.', action: 'Renovar plan' },
  { id: 'a4', variant: 'destructive', title: 'No pudimos sincronizar tus pedidos', text: 'Revisa tu conexión. Reintentaremos automáticamente en un minuto.', action: 'Reintentar ahora' },
] as const

export function BannersDemo() {
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())
  const hide = (id: string) => setGone((g) => new Set(g).add(id))
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader title="Alertas en línea con acción" description="Viven junto al contenido al que se refieren. Las que aparecen de golpe llevan role=alert; las informativas, role=status." />
        {ALERTS.filter((a) => !gone.has(a.id)).map((a) => (
          <Alert key={a.id} variant={a.variant}>
            <AlertTitle>{a.title}</AlertTitle>
            <AlertDescription>
              <p>{a.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {a.action && <Button size="sm" variant="outline">{a.action}</Button>}
                {a.variant !== 'destructive' && <Button size="sm" variant="ghost" onClick={() => hide(a.id)}>Descartar</Button>}
              </div>
            </AlertDescription>
          </Alert>
        ))}
        {ALERTS.every((a) => gone.has(a.id)) && <Button size="sm" variant="outline" onClick={() => setGone(new Set())}>Restaurar alertas</Button>}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Banners de página" description="Ocupan todo el ancho, arriba de la página, y hablan de algo que afecta a toda la sesión. Una sola acción y un descarte; si es crítico, no se puede descartar." />
        <div className="overflow-hidden rounded-lg border">
          {BANNERS.filter((b) => !gone.has(b.id)).map((b) => (
            <div key={b.id} role="status" className="flex flex-wrap items-center gap-3 border-b bg-accent px-4 py-2 text-sm last:border-b-0">
              <b.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="min-w-0 flex-1">{b.text}</p>
              {'action' in b && <Button size="sm" variant="outline">{b.action}</Button>}
              {b.dismissible && <Button size="icon" variant="ghost" aria-label="Descartar aviso" onClick={() => hide(b.id)}><X /></Button>}
            </div>
          ))}
          <p className="p-6 text-sm text-muted-foreground">Contenido de la página…</p>
        </div>
        {BANNERS.some((b) => gone.has(b.id)) && <Button size="sm" variant="outline" onClick={() => setGone(new Set())}>Restaurar banners</Button>}
      </section>
    </div>
  )
}
