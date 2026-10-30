'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, OctagonAlert, RefreshCw, TriangleAlert } from 'lucide-react'
import { Badge, Button, Card, CardContent, Progress } from '@/components/ui'
import { a11yAudit, auditTouch, contrastTable, isCoarse, sizeClassNow } from '@/lib/audits'
import { COMPONENT_STATUS } from '@/lib/data/system'

type St = 'ok' | 'warn' | 'fail'
interface Check { name: string; st: St; detail: string }

const fmtS = (ms: number) => `${(ms / 1000).toFixed(2).replace('.', ',')} s`

/** Mide LCP y CLS con el buffer del navegador (si la métrica no está disponible, queda «Midiendo…»). */
function readVitals(): Promise<{ lcp?: number; cls: number }> {
  return new Promise((resolve) => {
    const v: { lcp?: number; cls: number } = { cls: 0 }
    const obs: PerformanceObserver[] = []
    const add = (type: string, cb: (e: PerformanceEntryList) => void) => {
      try { const o = new PerformanceObserver((l) => cb(l.getEntries())); o.observe({ type, buffered: true } as PerformanceObserverInit); obs.push(o) } catch { /* no soportado */ }
    }
    add('largest-contentful-paint', (e) => { v.lcp = e[e.length - 1].startTime })
    add('layout-shift', (e) => { v.cls += (e as unknown as Array<{ value: number; hadRecentInput: boolean }>).filter((x) => !x.hadRecentInput).reduce((a, x) => a + x.value, 0) })
    setTimeout(() => { obs.forEach((o) => o.disconnect()); resolve(v) }, 120)
  })
}

async function runChecks(): Promise<Check[]> {
  const out: Check[] = []
  const pairs = contrastTable(), okPairs = pairs.filter((p) => p.ok).length
  out.push({ name: 'Contraste AA de los tokens (tema actual)', st: okPairs === pairs.length ? 'ok' : 'fail', detail: `${okPairs} de ${pairs.length} pares cumplen.` })
  const a = a11yAudit(), er = a.out.filter((o) => o.sev === 'error').length, wr = a.out.filter((o) => o.sev === 'warn').length
  out.push({ name: 'Auditor de accesibilidad sobre el DOM', st: er ? 'fail' : wr ? 'warn' : 'ok', detail: `${er} errores y ${wr} avisos en ${a.checked} textos revisados.` })
  const sc = sizeClassNow(), t = auditTouch(), applies = sc !== 'expanded' || isCoarse()
  out.push({ name: 'Objetivos táctiles de al menos 44×44', st: applies && t.bad.length ? 'fail' : 'ok', detail: applies ? `${t.bad.length} de ${t.n} controles por debajo de 44 px (clase ${sc}).` : `Clase expanded con puntero fino: se informa, no es obligatorio (${t.bad.length} de ${t.n}).` })
  const vp = document.querySelector<HTMLMetaElement>('meta[name=viewport]')?.content ?? ''
  out.push({ name: 'El zoom nunca se bloquea', st: /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp) ? 'fail' : 'ok', detail: `viewport: ${vp || 'sin definir'}` })
  const sw = document.documentElement.scrollWidth
  out.push({ name: 'Sin scroll horizontal de página', st: sw > innerWidth + 1 ? 'fail' : 'ok', detail: `${sw} px de contenido en ${innerWidth} px de ventana.` })
  let rm = false
  for (const sh of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try { rules = sh.cssRules } catch { continue }
    for (const r of Array.from(rules)) if (r instanceof CSSMediaRule && /prefers-reduced-motion/.test(r.conditionText)) rm = true
  }
  out.push({ name: 'Respeta «reducir movimiento»', st: rm ? 'ok' : 'fail', detail: rm ? 'Hay reglas para prefers-reduced-motion.' : 'No se encontraron reglas.' })
  const all = COMPONENT_STATUS.flatMap((r) => r.slice(1)), ok = all.filter((x) => x === 1).length, ap = all.filter((x) => x !== 'n').length, pct = Math.round((ok / ap) * 100)
  out.push({ name: 'Cumplimiento de la tabla de componentes', st: pct >= 80 ? 'ok' : 'warn', detail: `${ok} de ${ap} criterios aplicables (${pct} %).` })
  out.push({ name: 'Pruebas automáticas por componente', st: 'warn', detail: `Todavía 0 de ${COMPONENT_STATUS.length}: es la deuda que cierra el CI (axe, Playwright y visuales).` })
  const v = await readVitals()
  out.push({ name: 'LCP (contenido principal)', st: v.lcp == null ? 'warn' : v.lcp <= 2500 ? 'ok' : v.lcp <= 4000 ? 'warn' : 'fail', detail: v.lcp == null ? 'Midiendo…' : `${fmtS(v.lcp)} (bueno ≤ 2,5 s).` })
  out.push({ name: 'CLS (estabilidad visual)', st: v.cls <= 0.1 ? 'ok' : v.cls <= 0.25 ? 'warn' : 'fail', detail: `${v.cls.toFixed(3).replace('.', ',')} (bueno ≤ 0,1).` })
  const dom = document.getElementsByTagName('*').length
  out.push({ name: 'Tamaño del DOM', st: dom <= 1500 ? 'ok' : 'warn', detail: `${new Intl.NumberFormat('es-AR').format(dom)} elementos (cada pantalla real debe quedar bajo 1.500).` })
  return out
}

const META = {
  ok: { Icon: CircleCheck, cls: 'text-success', label: 'Cumple', badge: 'success' },
  warn: { Icon: TriangleAlert, cls: 'text-warning', label: 'Aviso', badge: 'warning' },
  fail: { Icon: OctagonAlert, cls: 'text-destructive', label: 'Falla', badge: 'destructive' },
} as const

export function HealthCard() {
  const [list, setList] = useState<Check[] | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useCallback(async () => { setBusy(true); await new Promise((r) => setTimeout(r, 30)); setList(await runChecks()); setBusy(false) }, [])
  useEffect(() => { const t = setTimeout(run, 400); return () => clearTimeout(t) }, [run])

  const ok = list?.filter((c) => c.st === 'ok').length ?? 0
  const warn = list?.filter((c) => c.st === 'warn').length ?? 0
  const fail = list?.filter((c) => c.st === 'fail').length ?? 0
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div aria-live="polite">
            <p className="text-xs text-muted-foreground">Comprobaciones que cumplen</p>
            <p className="font-display text-3xl font-bold tabular-nums">{list ? `${ok} de ${list.length}` : '—'}</p>
            <p className="text-xs text-muted-foreground">{busy ? 'Midiendo…' : list ? `${warn} avisos · ${fail} fallos · clase ${sizeClassNow()} (${innerWidth} px)` : ''}</p>
          </div>
          <Button variant="outline" onClick={run} disabled={busy}><RefreshCw className={busy ? 'animate-spin' : ''} /> Volver a medir</Button>
        </div>
        <Progress value={list ? Math.round((ok / list.length) * 100) : 0} aria-label="Salud del sistema" />
        <ul className="divide-y text-sm">
          {list?.map((c) => {
            const m = META[c.st]
            return (
              <li key={c.name} className="flex items-start gap-3 py-3">
                <m.Icon className={`mt-0.5 size-4 shrink-0 ${m.cls}`} aria-hidden="true" />
                <div className="min-w-0 flex-1"><p className="font-medium">{c.name}</p><p className="text-muted-foreground">{c.detail}</p></div>
                <Badge variant={m.badge} dot className="shrink-0">{m.label}</Badge>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
