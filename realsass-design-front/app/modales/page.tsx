import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { MODAL_RULES, MODAL_TYPES } from '@/lib/data/system'
import { ModalsDemo } from './modals-demo'
import { ModalsHeading, Playground, SearchAndMenu } from './modals-extra'

export const metadata: Metadata = { title: 'Modales' }

export default function ModalesPage() {
  return (
    <>
      <PageHeader
        title="Modales adaptables"
        description="Un solo primitivo con 6 presentaciones. Cada modal declara cómo se presenta en compact, medium y expanded y el sistema elige la que corresponde, incluso si giras el dispositivo con el modal abierto."
      />
      <section className="space-y-3">
        <SectionHeader title="Tipos y cuándo usarlos" size="sm" />
        <RefTable caption="Cada tipo de modal, para qué sirve y cómo se presenta" head={['Tipo', 'Úsalo para', 'Compact', 'Medium', 'Expanded', 'Rol']} rows={MODAL_TYPES} />
      </section>
      <ModalsDemo />
      <SearchAndMenu />
      <section className="space-y-3">
        <ModalsHeading />
        <Playground />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={MODAL_RULES} />
      </section>
    </>
  )
}
