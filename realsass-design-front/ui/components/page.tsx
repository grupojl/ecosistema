"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Badge } from "./badge"
import { Breadcrumb, type BreadcrumbItem } from "./breadcrumb"
import { Skeleton } from "./skeleton"

/**
 * Estructura de página compartida por todos los fronts (welver.html → «Norte», pilares 2 y 6).
 *
 *   <PageContainer size="lg">
 *     <PageHeader title="Pedidos" description="…" actions={<Button>…</Button>} />
 *     <SectionTabs items={…} />
 *     …contenido…
 *   </PageContainer>
 *
 * Toda vista con datos define sus 4 estados: cargando (`LoadingState`), vacío / error / sin permisos (`EmptyState`).
 */

const WIDTHS = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
} as const

/** Ancho y márgenes de una página: 16 px de gutter en compact, 24 px en medium, 32 px en expanded. */
function PageContainer({
  size = "lg", className, ...props
}: React.HTMLAttributes<HTMLDivElement> & { size?: keyof typeof WIDTHS }) {
  return (
    <div
      className={cn("mx-auto w-full space-y-6 px-4 py-6 medium:px-6 expanded:px-8 expanded:py-8", WIDTHS[size], className)}
      {...props}
    />
  )
}

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Ícono previo al título (opcional). */
  icon?: React.ReactNode
  /** Botones de la página; en compact bajan debajo del título. */
  actions?: React.ReactNode
  /** Ruta de navegación, solo a partir de 3 niveles de jerarquía. */
  breadcrumb?: readonly BreadcrumbItem[]
  breadcrumbLinkAs?: React.ElementType
}

/** Cabecera de página: título serif con filete dorado, descripción y acciones. Un solo `<h1>` por página. */
function PageHeader({
  title, description, icon, actions, breadcrumb, breadcrumbLinkAs, className, ...props
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-3", className)} {...props}>
      {breadcrumb && breadcrumb.length > 1 && <Breadcrumb items={breadcrumb} linkAs={breadcrumbLinkAs} />}
      <div className="flex flex-col gap-3 medium:flex-row medium:items-start medium:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-balance">
            {icon && <span className="text-muted-foreground [&_svg]:size-5" aria-hidden="true">{icon}</span>}
            {title}
          </h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

/** Título de una sección dentro de la página (`<h2>`), con descripción y acciones opcionales. */
function SectionHeader({
  title, description, icon, actions, size = "md", className, ...props
}: Omit<PageHeaderProps, "breadcrumb" | "breadcrumbLinkAs"> & { size?: "sm" | "md" }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)} {...props}>
      <div className="min-w-0 space-y-1">
        <h2 className={cn("flex items-center gap-2 font-display font-semibold tracking-tight", size === "sm" ? "text-sm" : "text-lg")}>
          {icon && <span className="text-muted-foreground [&_svg]:size-5" aria-hidden="true">{icon}</span>}
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export interface SectionTab {
  href: string
  label: string
  icon?: React.ReactNode
}

/** Navegación entre subpáginas de una misma sección (Tienda → Productos | Pedidos…). Cada destino mide >= 44 px. */
function SectionTabs({
  items, isActive, linkAs, label = "Secciones", className,
}: {
  items: readonly SectionTab[]
  isActive: (href: string) => boolean
  linkAs?: React.ElementType
  label?: string
  className?: string
}) {
  const Link: React.ElementType = linkAs ?? "a"
  return (
    <nav aria-label={label} className={cn("-mb-px overflow-x-auto border-b [scrollbar-width:none]", className)}>
      <ul className="flex gap-1">
        {items.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground [&_svg]:size-4"
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Tarjeta de una cifra: etiqueta, valor grande y apoyo opcional. Una cifra es una tarjeta, no un gráfico. */
function StatCard({
  label, value, icon, hint, className,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="card" className={cn("rounded-lg border bg-card p-4 text-card-foreground", className)}>
      <p className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Estado «cargando» de una vista: marcador con la forma del contenido y `aria-busy`. */
function LoadingState({
  rows = 3, className, label = "Cargando…",
}: { rows?: number; className?: string; label?: string }) {
  return (
    <div aria-busy="true" role="status" className={cn("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
    </div>
  )
}

/** Indicador de espera de pantalla completa (arranque de sesión). Para listas y tarjetas usa `LoadingState`. */
function Spinner({ className, label = "Cargando…" }: { className?: string; label?: string }) {
  return (
    <div role="status" className={cn("flex min-h-dvh items-center justify-center bg-background", className)}>
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Módulo aún no disponible: ícono, título, descripción y la etiqueta «Próximamente». */
function ComingSoon({
  icon, title, description, className,
}: { icon: React.ReactNode; title: string; description?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center", className)}>
      <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-7" aria-hidden="true">{icon}</span>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mx-auto max-w-sm text-muted-foreground">{description}</p>}
      </div>
      <Badge variant="secondary">Próximamente disponible</Badge>
    </div>
  )
}

export { PageContainer, PageHeader, SectionHeader, SectionTabs, StatCard, LoadingState, Spinner, ComingSoon }
