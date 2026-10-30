import type { Metadata } from 'next'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader, SectionHeader } from '@/components/ui'
import { RefTable } from '@/components/blocks'
import { ANTI_PATTERNS, FRONT_PRIORITY, PILLARS } from '@/lib/data/system'
import { TouchAudit } from './touch-audit'

export const metadata: Metadata = { title: 'Norte UI/UX' }

const SEVERITY = { Bloqueante: 'destructive', Alta: 'warning', Media: 'secondary' } as const

export default function NortePage() {
  return (
    <>
      <PageHeader
        title="Norte: UI/UX en desktop, tablet y mobile"
        description="Una sola interfaz que se adapta al dispositivo y al contexto, no tres interfaces distintas. Contrato 12 (ADR-024). Referentes: Shopify Polaris, Apple HIG y Material 3."
      />

      <section className="space-y-3">
        <SectionHeader title="Los 6 pilares" size="sm" />
        <ul className="grid gap-3 medium:grid-cols-2 expanded:grid-cols-3">
          {PILLARS.map((p) => (
            <li key={p.n}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span>{p.n} · {p.title}</span>
                    <Badge dot variant={p.state === 'ok' ? 'success' : 'warning'}>{p.state === 'ok' ? 'Cumple' : 'Falta CWV'}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent><CardDescription>{p.text}</CardDescription></CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Auditor táctil en vivo"
          description="Mide cada control visible de esta página y lista los que no llegan a 44×44 px. Los enlaces dentro de un párrafo están exentos (WCAG 2.5.8). Se exige en compact, medium y táctil; con puntero fino en expanded se informa pero no cuenta."
        />
        <TouchAudit />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Prioridad por front" description="Quién usa cada front y qué manda en su diseño." size="sm" />
        <RefTable caption="Prioridad por front" head={['Front', 'Quién lo usa', 'Qué manda']} rows={FRONT_PRIORITY} />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Anti-patrones (checklist de code review)" size="sm" />
        <RefTable
          caption="Anti-patrones prohibidos, su severidad y si esta referencia los cumple"
          head={['Anti-patrón', 'Severidad', 'En esta referencia']}
          rows={ANTI_PATTERNS.map(([a, s, r]) => [a, <Badge key={a} dot variant={SEVERITY[s]}>{s}</Badge>, r])}
        />
      </section>
    </>
  )
}
