import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, Info, Lightbulb, OctagonAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@real/ui'

/** Componentes de servidor que renderizan los tags/nodos de la whitelist de Markdoc. */

export function Heading({ id, level, children }: { id: string; level: number; children?: ReactNode }) {
  const Tag = `h${Math.min(Math.max(level, 1), 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  return (
    <Tag id={id} className="group scroll-mt-24">
      {children}
      {level >= 2 && level <= 3 ? (
        <a
          href={`#${id}`}
          aria-label="Enlace a esta sección"
          className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          #
        </a>
      ) : null}
    </Tag>
  )
}

const CALLOUTS: Record<string, { icon: LucideIcon; label: string; className: string }> = {
  note: { icon: Info, label: 'Nota', className: 'border-sky-500/40 bg-sky-500/8 [&_svg]:text-sky-600 dark:[&_svg]:text-sky-400' },
  tip: { icon: Lightbulb, label: 'Consejo', className: 'border-emerald-500/40 bg-emerald-500/8 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400' },
  warning: { icon: AlertTriangle, label: 'Atención', className: 'border-amber-500/50 bg-amber-500/8 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400' },
  danger: { icon: OctagonAlert, label: 'Peligro', className: 'border-red-500/50 bg-red-500/8 [&_svg]:text-red-600 dark:[&_svg]:text-red-400' },
}

export function Callout({ type = 'note', title, children }: { type?: string; title?: string; children?: ReactNode }) {
  const variant = CALLOUTS[type] ?? CALLOUTS.note
  const Icon = variant.icon
  return (
    <aside role="note" className={cn('my-6 flex gap-3 rounded-lg border p-4', variant.className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 text-sm [&_p]:my-0 [&_p+p]:mt-2">
        <p className="font-semibold text-foreground">{title ?? variant.label}</p>
        <div className="mt-1 text-foreground/85">{children}</div>
      </div>
    </aside>
  )
}

export function Steps({ children }: { children?: ReactNode }) {
  return <ol className="docs-steps my-8 list-none space-y-0 p-0">{children}</ol>
}

export function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="docs-step relative border-l border-border pb-8 pl-10 last:border-l-transparent last:pb-0">
      <h3 className="mt-0 text-base font-semibold">{title}</h3>
      <div className="[&_p]:my-2">{children}</div>
    </li>
  )
}

export function DocLink({ href, title, children }: { href: string; title?: string; children?: ReactNode }) {
  const external = /^https?:\/\//.test(href)
  if (external) {
    return (
      <a href={href} title={title} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return (
    <Link href={href} title={title}>
      {children}
    </Link>
  )
}

export function DocTable({ children }: { children?: ReactNode }) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border">
      <table className="m-0 w-full">{children}</table>
    </div>
  )
}

const BADGE_COLORS: Record<string, string> = {
  blue: 'bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  green: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  amber: 'bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  red: 'bg-red-500/12 text-red-700 ring-red-500/30 dark:text-red-300',
}

export function InlineBadge({ color, children }: { color?: string; children?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 align-middle text-xs font-medium ring-1 ring-inset',
        (color && BADGE_COLORS[color]) || 'bg-muted text-muted-foreground ring-border',
      )}
    >
      {children}
    </span>
  )
}
