'use client'

/**
 * Gráficos que faltan en @real/ui (welver.html → «Gráficos y datos»). Prototipo local: LineChart y BarChart ya viven en @real/ui.
 * Reglas: la forma sigue al trabajo · color por entidad (`--chart-1…8`) · marcas finas · cada valor visible o en tabla ·
 * foco con teclado · todo con resumen para lectores de pantalla · el color nunca informa solo.
 */
import { useId, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { cn } from "@real/ui/utils"
import { Badge } from "./badge"

// ── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ data, color = 1, label, className }: { data: readonly number[]; color?: number; label: string; className?: string }) {
  const w = 120, h = 32, p = 2
  const [min, max] = [Math.min(...data), Math.max(...data)]
  const pts = data.map((v, i) => `${p + (i / Math.max(data.length - 1, 1)) * (w - p * 2)},${h - p - ((v - min) / Math.max(max - min, 1)) * (h - p * 2)}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={cn('h-8 w-full overflow-visible', className)} preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke={`var(--chart-${color})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1]?.split(',')[0]} cy={pts[pts.length - 1]?.split(',')[1]} r="2.5" fill={`var(--chart-${color})`} stroke="var(--card)" strokeWidth="2" />
    </svg>
  )
}

// ── Tarjeta de métrica (una cifra con tendencia y minigráfico) ───────────────
export function MetricCard({
  label, value, delta, data, color = 1, invert = false, hint,
}: { label: string; value: string; delta: number; data: readonly number[]; color?: number; invert?: boolean; hint?: string }) {
  const good = invert ? delta <= 0 : delta >= 0
  const Arrow = delta >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground tabular-nums">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className={cn('mt-1 inline-flex items-center gap-1 font-display text-sm font-semibold', good ? 'text-success-ink' : 'text-destructive-ink')}>
        <Arrow className="size-3.5" aria-hidden="true" />
        {delta >= 0 ? '+' : ''}{delta.toFixed(1).replace('.', ',')} % {hint ?? 'vs. período anterior'}
        <span className="sr-only"> ({good ? 'favorable' : 'desfavorable'})</span>
      </p>
      <Sparkline className="mt-3" data={data} color={color} label={`${label}: tendencia del período`} />
    </div>
  )
}

// ── Cifra principal (una por vista, ≥ 48 px, sans proporcional) ──────────────
export function HeroNumber({ label, value, caption }: { label: string; value: string; caption?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 tabular-nums">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[clamp(3rem,9cqi,3.75rem)] font-bold leading-none tracking-tight tabular-nums">{value}</p>
      {caption && <p className="mt-2 text-sm text-muted-foreground">{caption}</p>}
    </div>
  )
}

// ── Medidor (proporción contra un límite; la pista es el mismo tono más claro) ─
export function Meter({ label, value, max, format = (v: number) => String(v), tone = 'primary' }: { label: string; value: number; max: number; format?: (v: number) => string; tone?: 'primary' | 'success' | 'warning' | 'destructive' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = `var(--${tone})`
  return (
    <div className="space-y-1.5 tabular-nums">
      <p className="flex items-baseline justify-between gap-2 text-sm"><span>{label}</span><span className="font-display text-base font-bold tabular-nums">{format(value)} <span className="font-display text-base font-semibold text-muted-foreground">de {format(max)}</span></span></p>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${pct} %`} className="h-2 overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${color} 18%, var(--card))` }}>
        <div className="h-full origin-left rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Estado reservado: nunca es una serie y siempre lleva icono y texto ───────
const STATUS = {
  good: { variant: 'success', label: 'Bien' },
  warn: { variant: 'warning', label: 'Atención' },
  crit: { variant: 'destructive', label: 'Crítico' },
} as const
export function StatusPill({ status, children }: { status: keyof typeof STATUS; children?: ReactNode }) {
  const { variant, label } = STATUS[status]
  return <Badge variant={variant} dot>{children ?? label}</Badge>
}

// ── Barras horizontales: ranking de categorías, un solo color ────────────────
export interface HBarRow { label: string; value: number }
export function HBarChart({ title, rows, format = (v: number) => String(v), summary }: { title: string; rows: readonly HBarRow[]; format?: (v: number) => string; summary?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const sorted = useMemo(() => [...rows].sort((a, b) => b.value - a.value), [rows])
  return (
    <figure className="space-y-2 tabular-nums">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      {summary && <p className="sr-only">{summary}</p>}
      <ul className="grid gap-2.5">
        {sorted.map((r, i) => (
          <li key={r.label} tabIndex={0} aria-label={`${r.label}: ${format(r.value)}`} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 rounded-sm text-[0.8125rem] outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="truncate text-muted-foreground">{r.label}</span>
            <span className="relative h-4">
              <span className="ds-hbar block h-4 rounded-r bg-primary" style={{ width: `${(r.value / max) * 80}%`, ['--i' as string]: i }} />
              <span className="absolute top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap font-display text-sm font-bold tabular-nums" style={{ left: `${(r.value / max) * 80}%` }}>{format(r.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

// ── Mapa de calor secuencial (día × hora) ────────────────────────────────────
export function Heatmap({ title, rows, cols, data, format = (v: number) => String(v) }: { title: string; rows: readonly string[]; cols: readonly string[]; data: readonly (readonly number[])[]; format?: (v: number) => string }) {
  const id = useId()
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const max = Math.max(...data.flat(), 1)
  const move = (r: number, c: number, dr: number, dc: number) => {
    const nr = Math.min(rows.length - 1, Math.max(0, r + dr)), nc = Math.min(cols.length - 1, Math.max(0, c + dc))
    document.getElementById(`${id}-${nr}-${nc}`)?.focus()
  }
  return (
    <figure className="space-y-2 tabular-nums">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div role="grid" aria-label={title} className="grid gap-0.5 text-[0.6875rem]" style={{ gridTemplateColumns: `2.25rem repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span aria-hidden="true" />
        {cols.map((c) => <span key={c} role="columnheader" className="grid min-h-5 place-items-center font-display text-muted-foreground">{c}</span>)}
        {rows.map((r, ri) => (
          <div key={r} role="row" className="contents">
            <span role="rowheader" className="grid place-items-center font-display text-muted-foreground">{r}</span>
            {cols.map((c, ci) => {
              const v = data[ri]?.[ci] ?? 0
              return (
                <button
                  key={c} id={`${id}-${ri}-${ci}`} type="button" role="gridcell" aria-label={`${r} ${c}: ${format(v)}`} title={`${r} ${c}: ${format(v)}`}
                  onFocus={() => setActive({ r: ri, c: ci })} onMouseEnter={() => setActive({ r: ri, c: ci })}
                  onKeyDown={(e) => {
                    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
                    if (d[e.key]) { e.preventDefault(); move(ri, ci, ...d[e.key]) }
                  }}
                  className="min-h-7 rounded outline-none transition-transform hover:scale-110 focus-visible:z-10 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(8 + (v / max) * 92)}%, var(--card))` }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Menos</span>
        <span className="h-2 w-32 rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in oklab, var(--primary) 8%, var(--card)), var(--primary))' }} aria-hidden="true" />
        <span>Más</span>
        <span className="ml-auto font-display text-sm font-semibold text-foreground" aria-live="polite">{active ? `${rows[active.r]} ${cols[active.c]}: ${format(data[active.r]?.[active.c] ?? 0)}` : 'Recorre con las flechas'}</span>
      </div>
    </figure>
  )
}

// ── Área: evolución de UNA serie (con la línea de 2 px encima) ────────────────
export function AreaChart({ title, labels, data, format = (v: number) => String(v), summary }: { title: string; labels: readonly string[]; data: readonly number[]; format?: (v: number) => string; summary?: string }) {
  const W = 640, H = 220, P = { t: 12, r: 12, b: 26, l: 12 }
  const max = Math.max(...data, 1) * 1.1
  const x = (i: number) => P.l + (i / Math.max(data.length - 1, 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b)
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  const [i, setI] = useState<number | null>(null)
  const step = Math.ceil(labels.length / 6)
  return (
    <figure className="space-y-2 tabular-nums">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div className="relative" tabIndex={0} role="group" aria-label={`${title}. ${summary ?? ''} Usa las flechas para recorrer los valores.`}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); setI((v) => Math.min((v ?? -1) + 1, data.length - 1)) } if (e.key === 'ArrowLeft') { e.preventDefault(); setI((v) => Math.max((v ?? data.length) - 1, 0)) } if (e.key === 'Escape') setI(null) }}
        onBlur={() => setI(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" onPointerLeave={() => setI(null)}
          onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setI(Math.round(((e.clientX - r.left) / r.width * W - P.l) / (W - P.l - P.r) * (data.length - 1))) }}>
          {[0, 0.5, 1].map((t) => <line key={t} x1={P.l} x2={W - P.r} y1={y(max * t / 1.1)} y2={y(max * t / 1.1)} stroke="var(--border)" />)}
          <path d={`${line} L${x(data.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`} fill="var(--chart-1)" opacity="0.14" />
          <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {labels.map((l, k) => k % step === 0 && <text key={l + k} x={x(k)} y={H - 8} textAnchor="middle" fontSize="12" className="font-display" fill="var(--muted-foreground)">{l}</text>)}
          {i != null && data[i] != null && (<g><line x1={x(i)} x2={x(i)} y1={P.t} y2={H - P.b} stroke="var(--muted-foreground)" opacity=".55" /><circle cx={x(i)} cy={y(data[i])} r="4" fill="var(--chart-1)" stroke="var(--card)" strokeWidth="2" /></g>)}
        </svg>
        <p className="mt-1 min-h-5 text-xs text-muted-foreground" aria-live="polite">{i != null && data[i] != null ? <><span className="font-medium text-foreground">{labels[i]}</span>: <span className="font-display font-semibold text-foreground">{format(data[i])}</span></> : 'Pasa el cursor o usa ← → para ver cada valor.'}</p>
      </div>
    </figure>
  )
}
