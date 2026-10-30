import type { Metadata } from 'next'
import { Card, CardContent, PageHeader, SectionHeader } from '@/components/ui'
import { RefTable, RuleList } from '@/components/blocks'
import { LAYERS, TYPE_CRITERIA, TYPE_ROLES } from '@/lib/data/system'
import { Swatches } from './swatches'
import { SizeClassLive } from './size-class-live'
import { IconSizes } from './icon-sizes'

export const metadata: Metadata = { title: 'Fundamentos' }

const RADII = [['sm · 5 px', 'rounded-sm', 'Inputs, chips'], ['md · 8 px', 'rounded-md', 'Botones, selects'], ['lg · 12 px', 'rounded-lg', 'Cards, modals, panels'], ['full', 'rounded-full', 'Avatars, pills']] as const
const SHADOWS = [['shadow-sm', 'shadow-sm', 'Cards'], ['shadow-md', 'shadow-md', 'Menús, popovers'], ['shadow-xl', 'shadow-xl', 'Dialog, drawer']] as const
const SPACING = [['w-1', 4], ['w-2', 8], ['w-3', 12], ['w-4', 16], ['w-6', 24], ['w-8', 32], ['w-12', 48], ['w-16', 64]] as const

export default function FundamentosPage() {
  return (
    <>
      <PageHeader title="Fundamentos" description="Tokens de welver.css: solo se usan por nombre, nunca como valores sueltos." />

      <section className="space-y-3">
        <SectionHeader title="Tipografía" description="Variable fonts de Google Fonts: latín extendido (ñ, acentos, ç), licencia OFL y legibles en mobile." />
        <RefTable caption="Roles tipográficos" head={['Rol', 'Fuente', 'Peso', 'Uso']} rows={TYPE_ROLES} />
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div><p className="font-mono text-xs text-muted-foreground">text-5xl</p><p className="font-display text-5xl font-semibold tracking-tight text-balance">Vende más, mejor</p></div>
            <div><p className="font-mono text-xs text-muted-foreground">text-3xl</p><p className="font-display text-3xl font-semibold">Panel de pedidos</p></div>
            <div><p className="font-mono text-xs text-muted-foreground">text-xl</p><p className="font-display text-xl font-semibold">Catálogo de productos</p></div>
            <div><p className="font-mono text-xs text-muted-foreground">text-base</p><p className="text-pretty">El envío a Ñuñoa, Córdoba y São Paulo llega en 48 h. Texto de párrafo con interlineado cómodo.</p></div>
            <div><p className="font-mono text-xs text-muted-foreground">text-sm</p><p className="text-sm text-muted-foreground">Texto secundario, descripciones y ayudas de formulario.</p></div>
            <div><p className="font-mono text-xs text-muted-foreground">font-mono</p><p className="font-mono text-sm">SKU-00421 · ord_9f3a1c7e</p></div>
            <div><p className="font-mono text-xs text-muted-foreground">tabular-nums</p><p className="text-sm tabular-nums">1.234,56 · 9.876,54 — cifras alineadas en tablas</p></div>
          </CardContent>
        </Card>
        <RuleList items={TYPE_CRITERIA} />
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Paleta de colores"
          description="Definidos como canales HSL en --color-* y mapeados a Tailwind. Toca una tarjeta para copiar el token."
        />
        <Swatches />
        <p className="text-sm text-muted-foreground">
          Tokens <code className="font-mono">*-ink</code>: el color semántico (success, destructive, warning) sirve para fondos e iconos. Para texto sobre un fondo tintado (badges, alertas, errores) usa su variante ink: es más oscura en claro y más clara en oscuro para cumplir AA.
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Dark mode:</span> claro, oscuro o sistema, con next-themes (ThemeProvider de @real/ui). El selector de la barra recorre Sistema → Claro → Oscuro y se recuerda entre visitas. Las superficies suben de nivel (background → card → popover) en lugar de usar sombras.
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Espaciado" description="Escala de 4 px de Tailwind. Contenedor máximo: max-w-7xl (1280 px)." />
        <ul className="space-y-2">
          {SPACING.map(([cls, px]) => (
            <li key={px} className="flex items-center gap-3 text-sm">
              <span className="w-12 font-mono text-xs text-muted-foreground">{px} px</span>
              <span className={`${cls} h-3 rounded-sm bg-primary`} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Bordes, radios y elevación" />
        <ul className="flex flex-wrap gap-3">
          {RADII.map(([name, cls, use]) => (
            <li key={name} className={`${cls} grid size-24 place-items-center border bg-card p-2 text-center text-xs`}>
              <span><span className="block font-medium">{name}</span>{use}</span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-4">
          {SHADOWS.map(([name, cls, use]) => (
            <li key={name} className={`${cls} grid size-24 place-items-center rounded-lg border bg-card p-2 text-center text-xs`}>
              <span><span className="block font-mono font-medium">{name}</span>{use}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">En oscuro la elevación se comunica sobre todo con la superficie (card más clara que background) y el borde, porque la sombra apenas se ve.</p>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Capas (z-index)" size="sm" />
        <RefTable caption="Capas y su uso" head={['Token', 'Valor', 'Uso']} rows={LAYERS} />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Iconografía" description="lucide-react · estilo outline, trazo 2 px · 16 px inline, 20 px standalone. Decorativos con aria-hidden; un icono solo (sin texto) siempre lleva aria-label." />
        <IconSizes />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Clases de tamaño" description="compact < 600 · medium 600–839 · expanded ≥ 840. Cambia el ancho de la ventana." />
        <SizeClassLive />
      </section>
    </>
  )
}
