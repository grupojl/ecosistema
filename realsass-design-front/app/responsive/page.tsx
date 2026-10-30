import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { RESPONSIVE_RULES, SIZE_CLASSES } from '@/lib/data/system'
import { SizeClassLive } from '../fundamentos/size-class-live'
import { DevicePreview } from './device-preview'

export const metadata: Metadata = { title: 'Responsive' }

export default function ResponsivePage() {
  return (
    <>
      <PageHeader
        title="Responsive: 3 clases de tamaño"
        description="Mobile-first: los estilos base son compact y se amplían con medium: y expanded:. Son las únicas clases de tamaño (viven en @real/ui): sm: md: lg: xl: no existen."
      />
      <SizeClassLive />
      <section className="space-y-3">
        <SectionHeader title="Clases, dispositivo, navegación y patrones" size="sm" />
        <RefTable caption="Clases de tamaño" head={['Clase', 'Ancho', 'Dispositivo', 'Navegación', 'Patrones']} rows={SIZE_CLASSES} />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={RESPONSIVE_RULES} />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Vista previa por clase de tamaño" description="La página de inicio de esta app, dentro de un marco con el ancho de cada clase." />
        <DevicePreview />
      </section>
    </>
  )
}
