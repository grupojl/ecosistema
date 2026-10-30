import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { ComponentsDemo } from './components-demo'
import { MiscDemo } from './misc-demo'
import { TableDemo } from './table-demo'
import { StatusTable } from './status-table'

export const metadata: Metadata = { title: 'Componentes' }

export default function ComponentesPage() {
  return (
    <>
      <PageHeader title="Componentes" description="Ningún front arma UI propia: si falta una pieza, se crea primero en @real/ui. Cada bloque es el componente real." />
      <ComponentsDemo />
      <MiscDemo />
      <section className="space-y-3">
        <SectionHeader
          title="Table con los 4 estados"
          description="Cambia el estado de los datos, ordena por columna, filtra, cambia la densidad y selecciona filas para la acción masiva (con «Deshacer»). En compact se convierte en tarjetas."
        />
        <TableDemo />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Estado de los componentes" description="Qué cumple cada componente hoy. La columna «Pruebas» está en 0 de forma deliberada: es la deuda que cierra el CI." />
        <StatusTable />
      </section>
    </>
  )
}
