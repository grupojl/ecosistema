import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { A11Y_RULES, KEYMAP } from '@/lib/data/system'
import { ContrastLive } from './contrast-live'
import { A11yAudit } from './a11y-audit'
import { Vitals } from './vitals'

export const metadata: Metadata = { title: 'Accesibilidad' }

export default function AccesibilidadPage() {
  return (
    <>
      <PageHeader
        title="Accesibilidad"
        description="Objetivo: WCAG 2.2 AA. El contraste no se declara, se calcula en vivo con los valores reales de cada token. Cambia el tema y la tabla se recalcula."
      />

      <section className="space-y-3">
        <SectionHeader title="Contraste del tema actual" description="Texto normal ≥ 4,5:1 · componentes de UI y foco ≥ 3:1 (WCAG 1.4.3 y 1.4.11). AAA ≥ 7:1." />
        <ContrastLive />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Mapa de teclado" size="sm" />
        <RefTable caption="Teclas por componente" head={['Componente', 'Teclas']} rows={KEYMAP} />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={A11Y_RULES} />
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Auditor de accesibilidad en vivo"
          description="Revisa esta misma página: nombres accesibles, etiquetas, ids duplicados, referencias ARIA rotas, jerarquía de títulos, landmarks y el contraste real de cada texto visible. Sirve de prueba de humo mientras no haya axe en CI."
        />
        <A11yAudit />
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Rendimiento en vivo (Core Web Vitals)"
          description="Medido en tu navegador con el API de rendimiento. Umbrales «bueno»: LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1 · FCP ≤ 1,8 s. El INP aparece cuando interactúas con la página."
        />
        <Vitals />
      </section>
    </>
  )
}
