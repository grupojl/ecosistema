'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import {
  AreaChart, BarChart, Button, HBarChart, Heatmap, HeroNumber, LineChart, Meter, MetricCard, PageHeader, SectionHeader,
  SegmentedControl, StatusPill, toast,
} from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { CHART_FORMS, CHART_RULES, CHART_SERIES } from '@/lib/data/system'

const money = (v: number) => `$ ${Math.round(v).toLocaleString('es-AR')}`

/** Datos deterministas de ejemplo: 90 días por canal. */
const DAYS = 90
const label = (i: number) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(2026, 6, 31 + i))
const wave = (base: number, amp: number, phase: number) => Array.from({ length: DAYS }, (_, i) => Math.round(base + i * (amp / 6) + Math.sin(i / 4 + phase) * amp))
const CHANNELS = [
  { key: 'web', label: 'Tienda online', color: 1, data: wave(4200, 900, 0) },
  { key: 'wa', label: 'WhatsApp', color: 3, data: wave(1800, 350, 1.2) },
  { key: 'pos', label: 'Punto de venta', color: 4, data: wave(2400, 500, 2.4) },
] as const

/** Mapa de calor determinista: más pedidos al mediodía y a la tarde, menos de madrugada y los domingos. */
const HEAT = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 8 }, (_, h) => Math.round(6 + 38 * Math.exp(-((h - 3.2) ** 2) / 3.5) * (d === 6 ? 0.55 : d === 5 ? 0.85 : 1) + ((d * 7 + h * 3) % 5))))

const RANGES = { '7': 'Últimos 7 días', '30': 'Últimos 30 días', '90': 'Últimos 90 días' } as const
type Range = keyof typeof RANGES

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)

export function ChartsDemo() {
  const [range, setRange] = useState<Range>('30')
  const n = Number(range)

  const view = useMemo(() => {
    const labels = Array.from({ length: n }, (_, i) => label(DAYS - n + i))
    const series = CHANNELS.map((c) => ({ key: c.key, label: c.label, color: c.color, data: c.data.slice(-n) }))
    const totals = series.map((s) => sum(s.data))
    const total = sum(totals)
    const half = Math.floor(n / 2)
    const halves = (list: readonly number[]) => [sum(list.slice(0, half)), sum(list.slice(half))] as const
    const totalByDay = labels.map((_, i) => series.reduce((acc, s) => acc + s.data[i], 0))
    const [a, b] = halves(totalByDay)
    const deltas = series.map((s) => { const [x, y] = halves(s.data); return ((y - x) / x) * 100 })
    const weeks = Math.max(1, Math.floor(n / 7))
    const stacked = series.map((s) => ({ ...s, data: Array.from({ length: weeks }, (_, w) => sum(s.data.slice(w * 7, w * 7 + 7))) }))
    return {
      labels, series, totals, total, deltas, stacked, totalByDay,
      delta: ((b - a) / a) * 100,
      wLabels: Array.from({ length: weeks }, (_, w) => `S${w + 1}`),
    }
  }, [n])

  const csv = () => {
    const rows = [['Fecha', ...view.series.map((s) => s.label)], ...view.labels.map((l, i) => [l, ...view.series.map((s) => s.data[i])])]
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }))
    const el = document.createElement('a'); el.href = url; el.download = `ventas-${range}d.csv`; el.click(); URL.revokeObjectURL(url)
    toast.success('CSV exportado')
  }

  return (
    <div className="space-y-8 tabular-nums">
      <PageHeader title="Gráficos y datos" description="La forma sigue al trabajo: una cifra es una tarjeta, no un gráfico. Paleta validada, marcas finas, tabla gemela de cada gráfico y todo funciona con teclado." />

      <section className="space-y-3">
        <SectionHeader title="Panel de ejemplo" description="Cambia el rango: todo se recalcula con el mismo corte, así que los números siempre coinciden." />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl aria-label="Rango" value={range} onValueChange={setRange} options={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: RANGES[r] }))} />
          <Button size="sm" variant="outline" onClick={csv}><Download /> Exportar CSV</Button>
        </div>
        <div className="grid gap-3 expanded:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="[container-type:inline-size]">
            <HeroNumber
              label="Ventas del período" value={money(view.total)}
              caption={`${view.delta >= 0 ? '+' : ''}${view.delta.toFixed(1).replace('.', ',')} % vs. la primera mitad`}
            />
          </div>
          {view.series.map((s, i) => (
            <MetricCard key={s.key} label={s.label} value={money(view.totals[i])} color={s.color} delta={view.deltas[i]} data={s.data} hint={`· ${Math.round((view.totals[i] / view.total) * 100)} % del total`} />
          ))}
        </div>
        <LineChart
          title="Ventas por canal" labels={view.labels} series={view.series} format={money}
          summary={`Entre ${view.labels[0]} y ${view.labels[view.labels.length - 1]} las ventas totales fueron ${money(view.total)}.`}
        />
        <BarChart title="Ventas por semana y canal" labels={view.wLabels} series={view.stacked} format={money} summary="Columnas apiladas por semana: cada canal conserva su color." />
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Otras formas"
          description="Cada forma resuelve un trabajo distinto: evolución de una serie (área), ranking (barras horizontales), intensidad día × hora (mapa de calor), proporción contra un límite (medidor) y estado reservado."
        />
        <AreaChart title="Ventas totales por día" labels={view.labels} data={view.totalByDay} format={money} summary="Una sola serie: la evolución diaria de las ventas totales." />
        <div className="grid gap-6 medium:grid-cols-2">
          <HBarChart title="Ventas por canal (ranking)" rows={view.series.map((s, i) => ({ label: s.label, value: view.totals[i] }))} format={money} summary="Ranking de canales por ventas del período." />
          <div className="space-y-4">
            <p className="text-sm font-medium">Metas del mes</p>
            <Meter label="Ventas" value={view.total} max={Math.round(view.total * 1.25)} format={money} />
            <Meter label="Pedidos entregados" value={412} max={500} tone="success" />
            <Meter label="Almacenamiento" value={92} max={100} tone="destructive" format={(v) => `${v} %`} />
          </div>
        </div>
        <Heatmap title="Pedidos por día y hora" rows={['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']} cols={['8', '10', '12', '14', '16', '18', '20', '22']} data={HEAT} format={(v) => `${v} pedidos`} />
        <div className="space-y-2">
          <p className="text-sm font-medium">Estado (reservado: nunca es una serie)</p>
          <div className="flex flex-wrap gap-2"><StatusPill status="good" /><StatusPill status="warn" /><StatusPill status="crit" /><StatusPill status="good">API operativa</StatusPill></div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Paleta validada" description="Los colores se asignan por entidad y en orden fijo: «Tienda online» es siempre la serie 1, en todos los gráficos y aunque filtres. Nunca se genera un noveno color: la cola se agrupa en «Otros»." />
        <ul className="grid grid-cols-2 gap-2 medium:grid-cols-4">
          {CHART_SERIES.map(([name, token, use], i) => (
            <li key={name} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="size-6 shrink-0 rounded-md" style={{ background: `var(--chart-${i + 1})` }} aria-hidden="true" />
              <span className="min-w-0"><span className="block font-medium">{name}</span><span className="block font-mono text-xs text-muted-foreground">{token}</span>{use && <span className="block text-xs text-muted-foreground">{use}</span>}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Una sola serie usa el color de marca. En gráficos «todos contra todos» el tope es de 3 series.</p>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Qué forma usar" size="sm" />
        <RefTable caption="Para cada trabajo de los datos, la forma recomendada y la que se evita" head={['Los datos son…', 'Usa', 'Evita']} rows={CHART_FORMS} />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={CHART_RULES} />
      </section>
    </div>
  )
}
