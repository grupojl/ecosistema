'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowLeft, Bell, Bug, CloudOff, Compass, Copy, CreditCard, Database, Gauge, Hourglass, KeyRound, LayoutDashboard,
  LifeBuoy, Lock, LogIn, Mail, Package, RotateCcw, Search, ShieldCheck, ShoppingBag, Wallet, WifiOff, Wrench, X, House, type LucideIcon,
} from 'lucide-react'
import { Button, Input, SegmentedControl , toast } from '@/components/ui'
import { ERRORS, type ErrorKey, type SystemError } from '@/lib/data/errors'

const ICONS: Record<string, LucideIcon> = {
  compass: Compass, lock: Lock, 'key-round': KeyRound, gauge: Gauge, bug: Bug, wrench: Wrench, 'wifi-off': WifiOff, 'cloud-off': CloudOff,
  hourglass: Hourglass, 'credit-card': CreditCard, home: House, 'arrow-left': ArrowLeft, mail: Mail, 'layout-dashboard': LayoutDashboard,
  'log-in': LogIn, 'rotate-ccw': RotateCcw, bell: Bell, activity: Activity, database: Database, x: X, wallet: Wallet,
}
const icon = (name: string) => ICONS[name] ?? Compass

const TONE = {
  info: '[--tone:var(--primary)] [--tone-ink:var(--accent-foreground)]',
  warning: '[--tone:var(--warning)] [--tone-ink:var(--warning-ink)]',
  danger: '[--tone:var(--destructive)] [--tone-ink:var(--destructive-ink)]',
} as const

const WIDTHS = { auto: '100%', compact: '390px', medium: '720px', expanded: '1100px' } as const
type Width = keyof typeof WIDTHS

const reqId = () => 'req_' + Math.random().toString(16).slice(2, 10)

function Extra({ e, rid, seconds }: { e: SystemError; rid: string; seconds: number }) {
  const [copied, setCopied] = useState(false)
  switch (e.extra) {
    case 'search':
      return (
        <div className="space-y-2 pt-1">
          <form role="search" className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); toast.info('Buscando…', { description: 'Aquí se mostrarían los resultados de la tienda.' }) }}>
            <label className="sr-only" htmlFor="er-q">Buscar en la tienda</label>
            <Input id="er-q" type="search" placeholder="Buscar productos, pedidos…" autoComplete="off" />
            <Button type="submit" className="shrink-0">Buscar</Button>
          </form>
          <ul className="flex flex-wrap gap-2">
            {([['Pedidos', ShoppingBag], ['Productos', Package], ['Centro de ayuda', LifeBuoy]] as const).map(([t, I]) => (
              <li key={t}><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm hover:bg-accent" onClick={() => toast.info(t, { description: 'Aquí navegarías a esa sección.' })}><I className="size-4" aria-hidden="true" />{t}</button></li>
            ))}
          </ul>
        </div>
      )
    case 'role':
      return (
        <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-left">
          <div><dt className="text-xs text-muted-foreground">Tu rol</dt><dd className="font-medium">Colaborador</dd></div>
          <div><dt className="text-xs text-muted-foreground">Se necesita</dt><dd className="font-medium">Propietario</dd></div>
        </dl>
      )
    case 'saved':
      return <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" /> Guardamos lo que estabas editando.</p>
    case 'id':
      return (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          ID del error <code className="rounded border bg-muted px-1.5 font-mono text-xs">{rid}</code>
          <Button size="sm" type="button" variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(rid); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { toast.error('No se pudo copiar') } }}>
            <Copy /> {copied ? 'Copiado ✓' : 'Copiar'}
          </Button>
        </p>
      )
    case 'eta':
      return (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Tiempo estimado: <b className="text-foreground">unos 15 minutos</b> · termina hoy a las 02:30</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Mantenimiento en curso">
            <span className="block h-full w-2/5 animate-pulse rounded-full bg-[var(--tone)]" />
          </div>
        </div>
      )
    case 'decline':
      return <p className="text-sm text-muted-foreground">Motivo: <b className="text-foreground">fondos insuficientes</b> · tarjeta terminada en <span className="font-mono">4242</span> · no se hizo ningún cobro.</p>
    case 'countdown':
      return (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Podrás reintentar en <b className="tabular-nums text-foreground">{seconds}</b> s</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Espera para reintentar" aria-valuemin={0} aria-valuemax={12} aria-valuenow={seconds}>
            <div className="h-full rounded-full bg-[var(--tone)] transition-[width] duration-1000 ease-linear" style={{ width: `${(seconds / 12) * 100}%` }} />
          </div>
        </div>
      )
    default:
      return null
  }
}

export function ErrorStage() {
  const [key, setKey] = useState<ErrorKey>('404')
  const [width, setWidth] = useState<Width>('auto')
  const [rid, setRid] = useState('req_00000000')
  const [seconds, setSeconds] = useState(12)
  const [busy, setBusy] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const e: SystemError = ERRORS[key]

  useEffect(() => { setRid(reqId()) }, [key])
  useEffect(() => {
    if (key !== '429') return
    setSeconds(12)
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [key])

  const Big = e.bigIcon ? icon(e.bigIcon) : null
  const Corner = icon(e.icon)
  const P = icon(e.primary[1])
  const S = e.secondary ? icon(e.secondary[1]) : null
  const retryable = key === '500' || key === 'timeout' || key === 'offline'

  const onPrimary = () => {
    if (retryable) { setBusy(true); setTimeout(() => { setBusy(false); toast(key === 'offline' ? 'Sigues sin conexión' : 'Todavía no se resolvió', { description: 'Reintentaremos automáticamente en unos segundos.' }) }, 1100) }
    else toast.info(e.primary[0], { description: 'Acción de ejemplo: aquí iría la navegación real.' })
  }

  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Error" value={key} onValueChange={setKey}
        options={(Object.keys(ERRORS) as ErrorKey[]).map((k) => ({ value: k, label: ERRORS[k].tab }))}
      />
      <SegmentedControl aria-label="Ancho" value={width} onValueChange={setWidth} options={[{ value: 'auto', label: 'Auto' }, { value: 'compact', label: 'Compact' }, { value: 'medium', label: 'Medium' }, { value: 'expanded', label: 'Expanded' }]} />

      <div className="overflow-x-auto rounded-lg border bg-muted/40 p-2">
        <div className="mx-auto rounded-lg border bg-background [container-type:inline-size]" style={{ maxWidth: WIDTHS[width] }}>
          <div key={key} className={`ds-fade ${TONE[e.tone]} grid justify-items-center gap-6 px-4 py-8 text-center @[40rem]:grid-cols-[auto_1fr] @[40rem]:items-center @[40rem]:justify-items-start @[40rem]:gap-12 @[40rem]:p-12 @[40rem]:text-left`}>
            <div className="relative grid size-36 shrink-0 place-items-center @[40rem]:size-52" aria-hidden="true">
              <span className="absolute -inset-3 rounded-[2.8rem] border border-dashed border-[color-mix(in_oklab,var(--tone)_38%,transparent)] motion-safe:animate-[spin_28s_linear_infinite]" />
              <span className="absolute inset-0 rounded-[2.25rem] border border-[color-mix(in_oklab,var(--tone)_30%,transparent)] bg-gradient-to-br from-[color-mix(in_oklab,var(--tone)_20%,transparent)] to-[color-mix(in_oklab,var(--tone)_05%,transparent)]" />
              {e.code
                ? <span className="relative font-display text-5xl font-extrabold tracking-tighter text-[var(--tone-ink)] @[40rem]:text-6xl">{e.code}</span>
                : Big && <Big className="relative size-16 text-[var(--tone-ink)] @[40rem]:size-24" strokeWidth={1.4} />}
              <span className="absolute -right-3 -top-3 grid size-12 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--tone)_35%,transparent)] bg-background text-[var(--tone-ink)] shadow-md"><Corner className="size-6" /></span>
            </div>
            <div className="min-w-0 max-w-xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tone-ink)]">{e.eyebrow}</p>
              <h3 ref={titleRef} tabIndex={-1} className="font-display text-2xl font-bold tracking-tight text-balance medium:text-3xl">{e.title}</h3>
              <p className="text-pretty text-muted-foreground">{e.text}</p>
              <Extra e={e} rid={rid} seconds={seconds} />
              <div className="flex flex-wrap justify-center gap-2 pt-2 @[40rem]:justify-start">
                <Button className="w-full @[30rem]:w-auto" onClick={onPrimary} disabled={busy || (key === '429' && seconds > 0)}><P /> {busy ? 'Reintentando…' : e.primary[0]}</Button>
                {e.secondary && S && <Button variant="outline" className="w-full @[30rem]:w-auto" onClick={() => toast.info(e.secondary![0], { description: 'Acción de ejemplo.' })}><S /> {e.secondary[0]}</Button>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ul className="grid gap-1 text-xs text-muted-foreground medium:grid-cols-2">
        <li><b className="text-foreground">1 Emblema:</b> el código y un icono; el color indica la severidad.</li>
        <li><b className="text-foreground">2 Qué pasó:</b> un título humano, sin jerga ni culpar a la persona.</li>
        <li><b className="text-foreground">3 Qué hacer:</b> el siguiente paso y la tranquilidad que haga falta.</li>
        <li><b className="text-foreground">4 Acciones:</b> una principal que resuelve y una secundaria que da salida.</li>
        <li><b className="text-foreground">5 Ayuda contextual:</b> búsqueda en el 404, tu rol en el 403, el ID en el 500.</li>
        <li><b className="text-foreground">6 Contexto conservado:</b> la navegación sigue ahí; el error ocupa el contenido.</li>
      </ul>
    </div>
  )
}
