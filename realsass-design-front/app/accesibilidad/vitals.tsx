'use client'

import { useEffect, useState } from 'react'
import { Badge, Card, CardContent } from '@/components/ui'

interface Vitals { lcp?: number; cls: number; inp?: number; fcp?: number }

type Tone = 'success' | 'warning' | 'destructive' | 'secondary'
const grade = (v: number | undefined, good: number, poor: number): Tone => (v == null ? 'secondary' : v <= good ? 'success' : v <= poor ? 'warning' : 'destructive')
const LABEL: Record<Tone, string> = { success: 'Bueno', warning: 'Mejorable', destructive: 'Malo', secondary: 'Midiendo…' }
const seg = (v: number) => `${(v / 1000).toFixed(2).replace('.', ',')} s`

/** Core Web Vitals de esta página con PerformanceObserver (LCP, CLS, INP aproximado, FCP). */
export function Vitals() {
  const [v, setV] = useState<Vitals>({ cls: 0 })

  useEffect(() => {
    const obs: PerformanceObserver[] = []
    const watch = (type: string, cb: (entries: PerformanceEntryList) => void, opts: Record<string, unknown> = {}) => {
      try {
        const o = new PerformanceObserver((l) => cb(l.getEntries()))
        o.observe({ type, buffered: true, ...opts } as PerformanceObserverInit)
        obs.push(o)
      } catch { /* métrica no soportada en este navegador */ }
    }
    watch('largest-contentful-paint', (e) => setV((p) => ({ ...p, lcp: e[e.length - 1].startTime })))
    watch('paint', (e) => { const f = e.find((x) => x.name === 'first-contentful-paint'); if (f) setV((p) => ({ ...p, fcp: f.startTime })) })
    watch('layout-shift', (e) => {
      const add = (e as unknown as Array<{ value: number; hadRecentInput: boolean }>).filter((x) => !x.hadRecentInput).reduce((a, x) => a + x.value, 0)
      if (add) setV((p) => ({ ...p, cls: p.cls + add }))
    })
    watch('event', (e) => setV((p) => ({ ...p, inp: Math.max(p.inp ?? 0, ...e.map((x) => x.duration)) })), { durationThreshold: 40 })
    return () => obs.forEach((o) => o.disconnect())
  }, [])

  const items: ReadonlyArray<readonly [string, string, string, Tone]> = [
    ['LCP', 'Pintura del contenido principal', v.lcp == null ? '—' : seg(v.lcp), grade(v.lcp, 2500, 4000)],
    ['INP', 'Respuesta a la interacción', v.inp == null ? 'Interactúa con la página' : `${Math.round(v.inp)} ms`, grade(v.inp, 200, 500)],
    ['CLS', 'Estabilidad visual', v.cls.toFixed(3).replace('.', ','), grade(v.cls, 0.1, 0.25)],
    ['FCP', 'Primera pintura', v.fcp == null ? '—' : seg(v.fcp), grade(v.fcp, 1800, 3000)],
  ]
  return (
    <ul className="grid gap-3 medium:grid-cols-2 expanded:grid-cols-4" aria-live="polite">
      {items.map(([k, desc, val, tone]) => (
        <li key={k}>
          <Card className="h-full">
            <CardContent className="space-y-1 pt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="font-mono font-semibold text-foreground">{k}</span><Badge dot variant={tone}>{LABEL[tone]}</Badge></div>
              <p className="font-display text-2xl font-bold tabular-nums">{val}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
