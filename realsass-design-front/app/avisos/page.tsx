import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { NOTICE_KINDS, NOTICE_RULES } from '@/lib/data/system'
import { NoticesDemo } from './notices-demo'
import { ToastLab } from './toast-lab'
import { BannersDemo } from './banners-demo'
import { NotificationCenter } from './notification-center'

export const metadata: Metadata = { title: 'Avisos' }

export default function AvisosPage() {
  return (
    <>
      <PageHeader
        title="Avisos y notificaciones"
        description="Todo lo que le dice algo a la persona sin pedirle que cambie de pantalla. Cada aviso tiene un trabajo distinto; elegir bien evita avisos que se pierden o que estorban."
      />
      <section className="space-y-3">
        <SectionHeader title="Cuál usar" size="sm" />
        <RefTable caption="Componentes de aviso, cuándo usarlos y su comportamiento" head={['Componente', 'Úsalo para', 'Duración', 'Rol ARIA']} rows={NOTICE_KINDS} />
      </section>
      <ToastLab />
      <NoticesDemo />
      <BannersDemo />
      <NotificationCenter />
      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={NOTICE_RULES} />
      </section>
    </>
  )
}
