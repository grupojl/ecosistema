import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RuleList } from '@/components/blocks'
import { FORM_RULES } from '@/lib/data/system'
import { SignupForm } from './signup-form'
import { ControlsGallery } from './controls-gallery'
import { CheckoutFlow } from './checkout-flow'

export const metadata: Metadata = { title: 'Formularios' }

export default function FormulariosPage() {
  return (
    <>
      <PageHeader
        title="Formularios"
        description="Todo lo necesario para armar un formulario con los componentes de @real/ui: campos, validación, controles, subida de archivos y flujos por pasos."
      />
      <section className="space-y-3">
        <SectionHeader title="Registro con validación completa" description="Valida al salir del campo y al enviar. Si hay errores, un resumen enfocable arriba enlaza a cada campo. El error dice qué pasó + cómo arreglarlo." />
        <SignupForm />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Galería de controles" description="Todos los estados y variantes: normal, deshabilitado, solo lectura, inválido, con prefijo y sufijo, contador, rango, selección y archivos." />
        <ControlsGallery />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Flujo por pasos" description="Un stepper de 3 a 5 pasos. Cada paso se valida antes de avanzar y se puede volver atrás sin perder datos." />
        <CheckoutFlow />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={FORM_RULES} />
      </section>
    </>
  )
}
