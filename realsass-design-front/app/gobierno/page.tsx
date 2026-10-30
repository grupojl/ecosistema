import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { CHANGELOG, PROPOSAL_STEPS, VERSIONING, VERSION_RULES } from '@/lib/data/system'
import { HealthCard } from './health-card'
import { DefinitionOfDone } from './definition-of-done'
import { GuideChecklist } from './guide-checklist'

export const metadata: Metadata = { title: 'Gobierno' }

export default function GobiernoPage() {
  return (
    <>
      <PageHeader
        title="Gobierno del sistema"
        description="Un sistema de diseño no se mide por cuántos componentes tiene, sino por cuánto se puede confiar en él: una tarjeta de salud que se calcula sola, una definición clara de «hecho» y reglas de versionado."
      />

      <section className="space-y-3">
        <SectionHeader title="Salud del sistema (en vivo)" description="Se calcula sobre esta página con los mismos auditores y la clase de tamaño actual. Un «aviso» no es un fallo: es algo que hay que decidir o cerrar." />
        <HealthCard />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Definición de «hecho» para un componente" description="Un componente nuevo no se publica hasta cumplir todo esto. Marca lo que ya cumple el tuyo (se guarda en tu navegador). Los puntos con ⚡ se comprueban solos en la tarjeta de salud." />
        <DefinitionOfDone />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Versionado y deprecaciones" size="sm" />
        <RefTable caption="Tipos de versión" head={['Versión', 'Cuándo']} rows={VERSIONING} />
        <RuleList items={VERSION_RULES} />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Historial de esta referencia" size="sm" />
        <ol className="relative ml-2 space-y-4 border-l pl-6">
          {CHANGELOG.map(([v, t]) => (
            <li key={v} className="relative">
              <span className="absolute -left-[1.9rem] top-0.5 grid size-4 place-items-center rounded-full border bg-background"><span className="size-1.5 rounded-full bg-primary" /></span>
              <p className="font-mono text-xs font-semibold text-primary">v{v}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Cómo proponer un cambio" size="sm" />
        <ol className="grid gap-3 medium:grid-cols-2">
          {PROPOSAL_STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-lg border p-4 text-sm"><b>{i + 1} · {t}.</b> <span className="text-muted-foreground">{d}</span></li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Guía 10/10 — checklist de calidad" description="Qué hace falta para que este sistema sea una referencia de 10. Lo marcado «Hecho» está implementado; lo pendiente depende del repositorio real (build, CI, publicación): márcalo a medida que avances." />
        <GuideChecklist />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Notas de implementación" size="sm" />
        <RuleList
          items={[
            'Norte (ADR-024): los puntos de corte medium: 600 px y expanded: 840 px ya existen como variantes de Tailwind en @real/ui (welver.css).',
            'Todo token nuevo debe reflejarse en welver.css y pasar el panel de contraste de «Accesibilidad».',
            'Los modales usan Radix Dialog (semántica) y Vaul (hojas arrastrables) detrás de un único primitivo en @real/ui que recibe la presentación por clase de tamaño.',
            'Esta app consume @real/ui solo a través de components/ui: ahí se prototipa y se valida antes de que los demás fronts lo usen.',
          ]}
        />
      </section>
    </>
  )
}
