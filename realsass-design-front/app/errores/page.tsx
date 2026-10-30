import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { ERRORS } from '@/lib/data/errors'
import { ERROR_RULES } from '@/lib/data/system'
import { ErrorStage } from './error-stage'
import { ErrorPatterns } from './error-patterns'

export const metadata: Metadata = { title: 'Errores' }

export default function ErroresPage() {
  return (
    <>
      <PageHeader
        title="Páginas de error y estados del sistema"
        description="Los errores se diseñan antes de que ocurran. Una anatomía única que se adapta a compact, medium y expanded, el tono de cada caso y los patrones que acompañan a la página completa."
      />
      <section className="space-y-3">
        <SectionHeader title="Escenario: cada error, en cada tamaño" description="Elige un error y un ancho. La pantalla se reorganiza con una consulta de contenedor, así que se ve igual en una página, en un panel o en un iframe." />
        <ErrorStage />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Patrones que acompañan a la página" description="No todo error es una página. Estos cubren lo que pasa dentro de una pantalla que sí cargó." />
        <ErrorPatterns />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Guía de textos" size="sm" />
        <RefTable
          caption="Título, explicación y acción principal recomendados para cada error"
          head={['Error', 'Título (qué pasó)', 'Explicación (qué hacer)', 'Acción principal']}
          rows={Object.values(ERRORS).map((e) => [('code' in e ? e.code : e.tab), e.title, e.text, e.primary[0]])}
        />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={ERROR_RULES} />
      </section>
    </>
  )
}
