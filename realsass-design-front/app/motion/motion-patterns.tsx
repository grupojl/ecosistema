'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Check, Play } from 'lucide-react'
import { Avatar, AvatarFallback, Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Progress, Skeleton, Switch , toast } from '@/components/ui'

/** Tarjeta de patrón con «Reproducir»: cambiar `run` remonta el contenido y vuelve a animarlo. */
function Pattern({ title, text, children }: { title: string; text: string; children: (run: number) => ReactNode }) {
  const [run, setRun] = useState(0)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          {title}
          <Button size="sm" variant="ghost" onClick={() => setRun((r) => r + 1)} aria-label={`Reproducir: ${title}`}><Play /></Button>
        </CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      <CardContent><div key={run}>{children(run)}</div></CardContent>
    </Card>
  )
}

function Counter({ to }: { to: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min((t - t0) / 1000, 1)
      setV(Math.round(to * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{v.toLocaleString('es-AR')}</>
}

function SkeletonToContent() {
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 1200); return () => clearTimeout(t) }, [])
  return (
    <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
      <div className={`flex items-center gap-3 transition-opacity duration-300 ${ready ? 'opacity-0' : 'opacity-100'}`} aria-hidden={ready}>
        <Skeleton className="size-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-44" /></div>
      </div>
      <div className={`flex items-center gap-3 transition-all duration-500 ${ready ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'}`}>
        <Avatar><AvatarFallback>AL</AvatarFallback></Avatar>
        <div><p className="text-sm font-medium">Ana López</p><p className="text-xs text-muted-foreground">Cliente desde 2024 · 12 pedidos</p></div>
      </div>
    </div>
  )
}

function SaveButton() {
  const [st, setSt] = useState<'idle' | 'loading' | 'done'>('idle')
  const click = () => {
    setSt('loading')
    setTimeout(() => { setSt('done'); setTimeout(() => setSt('idle'), 1400) }, 1100)
  }
  return (
    <Button onClick={click} disabled={st === 'loading'} className="min-w-44" aria-live="polite">
      {st === 'idle' && 'Guardar cambios'}
      {st === 'loading' && 'Guardando…'}
      {st === 'done' && <><Check /> Guardado</>}
    </Button>
  )
}

function Feedback() {
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState(0)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setOk(true)}>Éxito</Button>
        {ok && (
          <svg className="ds-check size-9 text-success" viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-label="Listo" role="img">
            <circle cx="26" cy="26" r="24" /><path d="M15 27l8 8 14-16" />
          </svg>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setErr((e) => e + 1)}>Error</Button>
        <div key={err} className={err ? 'ds-shake' : ''}>
          <Input aria-label="Correo" aria-invalid={err ? true : undefined} placeholder="Correo" defaultValue={err ? 'ana@' : ''} />
        </div>
      </div>
    </div>
  )
}

const ORDER_STEPS = ['Preparando pedido', 'Cobrando', 'En camino', 'Entregado']
const SALES = 48920

export function MotionPatterns() {
  const [bar, setBar] = useState(0)
  useEffect(() => { const t = setTimeout(() => setBar(68), 100); return () => clearTimeout(t) }, [])
  return (
    <div className="grid gap-4 medium:grid-cols-2">
      <Pattern title="Entrada escalonada" text="Listas y grids: cada elemento 30–60 ms después del anterior.">
        {() => (
          <ul className="space-y-1.5 text-sm">
            {ORDER_STEPS.map((s, i) => <li key={s} className="ds-row-in rounded-md border px-3 py-2" style={{ ['--i' as string]: i }}>{s}</li>)}
          </ul>
        )}
      </Pattern>
      <Pattern title="Skeleton → contenido" text="Fundido cruzado: el contenido no «salta» al cargar.">{() => <SkeletonToContent />}</Pattern>
      <Pattern title="Contador y progreso" text="Los números suben hasta su valor; las barras se llenan.">
        {() => (
          <div className="space-y-2">
            <p className="font-display text-3xl font-bold tabular-nums">$ <Counter to={SALES} /></p>
            <p className="text-xs text-muted-foreground">Ventas del mes</p>
            <Progress value={bar} aria-label="Preparación" />
          </div>
        )}
      </Pattern>
      <Pattern title="Éxito y error" text="El check se dibuja; el error sacude el campo una vez.">{() => <Feedback />}</Pattern>
      <Pattern title="Botón con estados" text="Reposo → cargando → éxito → reposo, sin cambiar de tamaño.">{() => <SaveButton />}</Pattern>
      <Pattern title="Controles con carácter" text="Switch, tarjeta que se eleva, aviso «en vivo».">
        {() => (
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex min-h-11 items-center gap-2 text-sm"><Switch /> Resorte</label>
            <div className="rounded-lg border bg-card px-3 py-2 text-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md">Elevar</div>
            <Button size="sm" variant="outline" onClick={() => toast.info('Aviso en vivo', { description: 'Se pausa al apuntarlo.' })}>Mostrar toast</Button>
          </div>
        )}
      </Pattern>
    </div>
  )
}
