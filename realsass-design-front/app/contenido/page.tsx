import type { Metadata } from 'next'
import { Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, PageHeader, SectionHeader } from '@/components/ui'
import { RefTable } from '@/components/blocks'
import { CONTENT_RULES } from '@/lib/data/system'

export const metadata: Metadata = { title: 'Contenido' }

const N = 1234567.89
const D = new Date(2026, 9, 29, 14, 30)
const FORMATS: ReadonlyArray<readonly [string, string, string]> = [
  ['Número', 'es-AR', new Intl.NumberFormat('es-AR').format(N)],
  ['Moneda', 'es-AR · ARS', new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(N)],
  ['Moneda', 'es-CL · CLP', new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(N)],
  ['Moneda', 'es-MX · MXN', new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(N)],
  ['Porcentaje', 'es-AR', new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 }).format(0.124)],
  ['Fecha', 'es-AR', new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(D)],
  ['Fecha y hora', 'es-AR', new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(D)],
  ['Relativo', 'es', new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(-1, 'day')],
]

export default function ContenidoPage() {
  return (
    <>
      <PageHeader
        title="Guía de contenido (es-LA)"
        description="Un buen sistema también define cómo habla. Tono: claro, cercano y respetuoso. Tuteo, frases cortas, sin jerga técnica ni culpar al usuario."
      />
      <ul className="grid gap-4 medium:grid-cols-2">
        {CONTENT_RULES.map((r) => (
          <li key={r.title}>
            <Card className="h-full">
              <CardHeader className="pb-2"><CardTitle className="text-base">{r.title}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Sí" />{r.good}</p>
                <p className="flex gap-2 text-muted-foreground"><X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="No" />{r.bad}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <section className="space-y-3">
        <SectionHeader title="Números, moneda y fechas" description="Formatea siempre con Intl según la configuración del usuario; nunca concatenes a mano." />
        <RefTable caption="Formatos por tipo y locale" head={['Tipo', 'Locale', 'Resultado']} rows={FORMATS.map(([a, b, c]) => [a, b, <span key={c} className="tabular-nums">{c}</span>])} />
      </section>
    </>
  )
}
