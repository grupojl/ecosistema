import type { Metadata } from 'next'
import { Boxes, Rocket } from 'lucide-react'
import { ComingSoon, EmptyState, LoadingState, PageHeader, SectionHeader, StatCard } from '@/components/ui'

export const metadata: Metadata = { title: 'Estados' }

export default function EstadosPage() {
  return (
    <>
      <PageHeader title="Estados de una vista" description="Toda vista con datos define los cuatro: cargando, vacío, error y sin permisos." />
      <section className="space-y-3">
        <SectionHeader title="Una cifra es una tarjeta" size="sm" />
        <div className="grid gap-3 medium:grid-cols-3">
          <StatCard label="Pedidos hoy" value="42" hint="+8 vs. ayer" icon={<Boxes />} />
          <StatCard label="Ingresos" value="$ 312.400" />
          <StatCard label="Conversión" value="3,4 %" />
        </div>
      </section>
      <section className="space-y-3">
        <SectionHeader title="Cargando" size="sm" />
        <LoadingState rows={2} />
      </section>
      <section className="grid gap-4 medium:grid-cols-3">
        <div className="space-y-2"><SectionHeader title="Vacío" size="sm" /><EmptyState kind="empty" /></div>
        <div className="space-y-2"><SectionHeader title="Error" size="sm" /><EmptyState kind="error" /></div>
        <div className="space-y-2"><SectionHeader title="Sin permisos" size="sm" /><EmptyState kind="forbidden" /></div>
      </section>
      <section className="space-y-3">
        <SectionHeader title="Módulo futuro" size="sm" />
        <ComingSoon icon={<Rocket />} title="Campañas" description="Estamos terminando este módulo." className="min-h-0 rounded-lg border border-dashed" />
      </section>
    </>
  )
}
