import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { TokenExport } from './token-export'

export const metadata: Metadata = { title: 'Temas y tokens' }

export default function TemasPage() {
  return (
    <>
      <PageHeader
        title="Temas y tokens"
        description="Welver tiene una sola identidad, con modo claro y modo oscuro. Los tokens que ves en esta app se pueden exportar tal cual: una sola fuente."
      />
      <section className="space-y-3">
        <SectionHeader
          title="Exportar los tokens"
          description="Se generan leyendo los valores reales de esta página, no una copia a mano. Pega el CSS en globals.css, el preset en la config de Tailwind o importa el JSON en tu herramienta de diseño."
        />
        <TokenExport />
      </section>
    </>
  )
}
