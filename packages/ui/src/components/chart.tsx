"use client"

import * as React from "react"

import { cn } from "@real/ui/utils"

/**
 * Gráficos (welver.html → «Gráficos y datos»). Sin dependencias: SVG propio.
 *
 *  - La forma sigue al trabajo: una cifra es una tarjeta, no un gráfico.
 *  - Paleta categórica de 8 series validada (tokens `--chart-1…8`, claro y oscuro). El color sigue a la ENTIDAD,
 *    no a su posición: fija `color` (1–8) en cada serie y no cambia al filtrar. Nunca un noveno color: agrupa en «Otros».
 *  - Dos o más series: leyenda siempre; tocar una serie la aísla.
 *  - Tooltip también con teclado (← →) y tabla gemela de los datos («Ver datos»).
 *  - Marcas finas (línea de 2 px), cuadrícula discreta.
 */
export interface ChartSeries {
  key: string
  label: string
  data: readonly number[]
  /** Posición fija en la paleta (1–8) para esta entidad. Por defecto, su orden. */
  color?: number
}

export interface ChartProps {
  /** Título accesible del gráfico. */
  title: string
  /** Etiquetas del eje X (una por dato). */
  labels: readonly string[]
  series: readonly ChartSeries[]
  /** Formato de los valores (tooltip, eje y tabla). */
  format?: (value: number) => string
  /** Resumen para lectores de pantalla (p. ej. «Los ingresos subieron 12 %»). */
  summary?: string
  className?: string
}

const W = 640
const H = 260
const PAD = { top: 12, right: 12, bottom: 28, left: 72 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const colorOf = (s: ChartSeries, i: number) => `var(--chart-${Math.min(Math.max(s.color ?? i + 1, 1), 8)})`

function niceMax(value: number): number {
  if (value <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(value))
  const n = value / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

function useChart(props: ChartProps) {
  const { labels, series } = props
  const [isolated, setIsolated] = React.useState<string | null>(null)
  const [active, setActive] = React.useState<number | null>(null)
  const visible = series.filter((s) => !isolated || s.key === isolated)
  const format = props.format ?? ((v: number) => String(v))
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setActive((i) => Math.min((i ?? -1) + 1, labels.length - 1)) }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setActive((i) => Math.max((i ?? labels.length) - 1, 0)) }
    else if (e.key === "Escape") setActive(null)
  }
  return { isolated, setIsolated, active, setActive, visible, format, onKeyDown }
}

function Frame({
  props, state, children, stacked,
}: {
  props: ChartProps
  state: ReturnType<typeof useChart>
  children: (yMax: number) => React.ReactNode
  stacked: boolean
}) {
  const { title, labels, series, summary, className } = props
  const { isolated, setIsolated, active, setActive, visible, format, onKeyDown } = state
  const totals = labels.map((_, i) => visible.reduce((sum, s) => sum + (s.data[i] ?? 0), 0))
  const yMax = niceMax(stacked ? Math.max(...totals, 0) : Math.max(...visible.flatMap((s) => [...s.data]), 0))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax)

  return (
    <figure className={cn("space-y-3 tabular-nums", className)}>
      <figcaption className="font-medium">{title}</figcaption>
      {summary && <p className="sr-only">{summary}</p>}

      {series.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Series">
          {series.map((s, i) => {
            const dim = isolated && isolated !== s.key
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={isolated === s.key}
                  onClick={() => setIsolated(isolated === s.key ? null : s.key)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-opacity hover:bg-accent aria-pressed:border-primary aria-pressed:bg-accent",
                    dim && "opacity-50"
                  )}
                >
                  <span className="size-2.5 rounded-full" style={{ background: colorOf(s, i) }} aria-hidden="true" />
                  {s.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={title}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="h-auto w-full rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        >
          {ticks.map((t) => {
            const y = PAD.top + PLOT_H - (t / yMax) * PLOT_H
            return (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="12" className="font-display" fill="var(--muted-foreground)">{format(t)}</text>
              </g>
            )
          })}
          {labels.map((l, i) => {
            const every = Math.ceil(labels.length / 8)
            if (i % every !== 0) return null
            const cx = PAD.left + (labels.length <= 1 ? PLOT_W / 2 : (i + 0.5) * (PLOT_W / labels.length))
            return <text key={l + i} x={cx} y={H - 8} textAnchor="middle" fontSize="12" className="font-display" fill="var(--muted-foreground)">{l}</text>
          })}
          {children(yMax)}
          {labels.map((l, i) => (
            <rect
              key={`hit-${l}-${i}`}
              x={PAD.left + i * (PLOT_W / labels.length)} y={PAD.top} width={PLOT_W / labels.length} height={PLOT_H}
              fill={active === i ? "var(--accent)" : "transparent"} opacity={active === i ? 0.5 : 1}
              onPointerEnter={() => setActive(i)} onPointerMove={() => setActive(i)}
              style={{ pointerEvents: "all" }}
              className="-z-10"
              aria-hidden="true"
            />
          ))}
        </svg>

        <div className="min-h-10 text-sm" role="status" aria-live="polite">
          {active !== null && (
            <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-sm">
              <p className="font-medium">{labels[active]}</p>
              <ul className="mt-1 space-y-0.5">
                {visible.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-6 text-xs">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: colorOf(s, series.indexOf(s)) }} aria-hidden="true" />
                      {s.label}
                    </span>
                    <span className="font-display font-semibold tabular-nums">{format(s.data[active] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <details className="rounded-lg border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Ver datos</summary>
        <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={`Datos de ${title} (desplazable)`}>
          <table className="w-full text-left text-xs tabular-nums">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium" />
                {series.map((s) => <th key={s.key} scope="col" className="py-2 pr-4 text-right font-medium">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l + i} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-4 font-medium">{l}</th>
                  {series.map((s) => <td key={s.key} className="py-2 pr-4 text-right font-display">{format(s.data[i] ?? 0)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/** Evolución en el tiempo de 1 a 8 series. */
function LineChart(props: ChartProps) {
  const state = useChart(props)
  const { labels, series } = props
  return (
    <Frame props={props} state={state} stacked={false}>
      {(yMax) => state.visible.map((s) => {
        const i0 = series.indexOf(s)
        const pts = s.data.map((v, i) => {
          const px = PAD.left + (i + 0.5) * (PLOT_W / labels.length)
          const py = PAD.top + PLOT_H - (v / yMax) * PLOT_H
          return [px, py] as const
        })
        return (
          <g key={s.key} fill="none" stroke={colorOf(s, i0)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={pts.map((p) => p.join(",")).join(" ")} />
            {state.active !== null && pts[state.active] && (
              <circle cx={pts[state.active]![0]} cy={pts[state.active]![1]} r="4" fill="var(--background)" />
            )}
          </g>
        )
      })}
    </Frame>
  )
}

/** Composición por categoría: barras apiladas. */
function BarChart(props: ChartProps) {
  const state = useChart(props)
  const { labels, series } = props
  return (
    <Frame props={props} state={state} stacked>
      {(yMax) => labels.map((l, i) => {
        const bw = (PLOT_W / labels.length) * 0.6
        const bx = PAD.left + i * (PLOT_W / labels.length) + ((PLOT_W / labels.length) - bw) / 2
        let acc = 0
        return (
          <g key={l + i}>
            {state.visible.map((s) => {
              const v = s.data[i] ?? 0
              const h = (v / yMax) * PLOT_H
              const y = PAD.top + PLOT_H - ((acc + v) / yMax) * PLOT_H
              acc += v
              return <rect key={s.key} x={bx} y={y} width={bw} height={Math.max(h - 1, 0)} rx="2" fill={colorOf(s, series.indexOf(s))} />
            })}
          </g>
        )
      })}
    </Frame>
  )
}

export { LineChart, BarChart }
