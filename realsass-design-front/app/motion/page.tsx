import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { MODAL_MOTION, MOTION_CURVES, MOTION_DURATIONS, MOTION_RULES } from '@/lib/data/system'
import { MotionPatterns } from './motion-patterns'
import { CurveRace } from './curve-race'

export const metadata: Metadata = { title: 'Motion' }

export default function MotionPage() {
  return (
    <>
      <PageHeader
        title="Motion"
        description="El movimiento explica de dónde viene algo, qué cambió y que el sistema respondió. Solo se anima transform y opacity, y todo se apaga con prefers-reduced-motion."
      />

      <section className="space-y-3">
        <SectionHeader title="Tokens: duración y curvas" size="sm" />
        <RefTable caption="Duraciones de motion y su uso" head={['Duración', 'Uso']} rows={MOTION_DURATIONS} />
        <RefTable
          caption="Curvas de easing"
          head={['Token', 'Curva', 'Uso']}
          rows={MOTION_CURVES.map(([n, c, u]) => [<code key={n} className="font-mono text-xs">--{n}</code>, <code key={c} className="font-mono text-xs">{c}</code>, u])}
        />
        <CurveRace />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Patrones" description="Cada tarjeta es un patrón real del sistema. Pulsa «Reproducir» para volver a verlo." />
        <MotionPatterns />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Modales y paneles" description="En compact todo entra de abajo hacia arriba, como en una app nativa. En medium y expanded el movimiento es corto y suave." />
        <RefTable caption="Cómo entra y sale cada presentación" head={['Presentación', 'Entrada', 'Salida', 'Duración']} rows={MODAL_MOTION} />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={MOTION_RULES} />
      </section>
    </>
  )
}
