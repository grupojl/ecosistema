import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@real/ui/utils"

/**
 * Piezas de las páginas públicas (landing, storefront, ayuda) — welver.html → «Topbar» y «bn-item».
 *
 *   <SiteHeader brand={<SiteBrand name="Acme" icon={<Building2 />} />} links={…} actions={<ThemeToggle compact />} />
 *   <SectionIntro eyebrow="Funciones" title="Todo lo que necesitás" description="…" />
 *   <SiteFooter brand="Acme" tagline="…" columns={…} legal="© 2026 Acme" />
 *   <BottomTabBar items={…} activeId={activo} />
 *
 * Los enlaces son `<a>` por defecto; con `linkAs={Link}` (next/link) la navegación es la del router.
 * Todo el color y el espaciado salen de los tokens: cambiar acá cambia todos los fronts.
 */

export interface SiteLink {
  id: string
  label: string
  href: string
}

type LinkAs = React.ElementType

/** Marca: cuadro con ícono + nombre. */
function SiteBrand({
  name, icon, logoUrl, href = "/", linkAs: As = "a", label, className,
}: { name: string; icon?: React.ReactNode; logoUrl?: string | null; href?: string; linkAs?: LinkAs; label?: string; className?: string }) {
  return (
    <As href={href} aria-label={label ?? name} className={cn("flex min-w-0 items-center gap-2 rounded-md font-display font-bold", className)}>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
      )}
      {icon && (
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground [&_svg]:size-4" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="text-lg tracking-tight">{name}</span>
    </As>
  )
}

/** Barra superior sticky de 56 px: marca, secciones (desde medium) y acciones. En compact la navegación va en `BottomTabBar`. */
function SiteHeader({
  brand, links = [], actions, linkAs: As = "a", navLabel = "Principal", className,
}: {
  brand: React.ReactNode
  links?: readonly SiteLink[]
  actions?: React.ReactNode
  linkAs?: LinkAs
  navLabel?: string
  className?: string
}) {
  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/85 backdrop-blur", className)}>
      <nav aria-label={navLabel} className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-8">
        {brand}
        {links.length > 0 && (
          <ul className="ml-6 hidden items-center gap-1 medium:flex">
            {links.map((link) => (
              <li key={link.id}>
                <As
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {link.label}
                </As>
              </li>
            ))}
          </ul>
        )}
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </nav>
    </header>
  )
}

/** Encabezado centrado de una sección de página pública: etiqueta, título serif (`<h2>`) y bajada. */
function SectionIntro({
  eyebrow, title, description, className, ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)} {...props}>
      {eyebrow && <span className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</span>}
      <h2 className="mt-3 font-display text-3xl text-foreground text-balance md:text-4xl lg:text-5xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  )
}

export interface FooterColumn {
  title: string
  links: readonly { label: string; href: string }[]
}

/** Pie de página: marca + bajada, columnas de enlaces y línea legal. */
function SiteFooter({
  brand, tagline, columns, legal, linkAs: As = "a", className, ...props
}: Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  brand: React.ReactNode
  tagline?: React.ReactNode
  columns: readonly FooterColumn[]
  legal?: React.ReactNode
  linkAs?: LinkAs
}) {
  return (
    <footer className={cn("border-t border-border bg-muted/50", className)} {...props}>
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className={cn("grid grid-cols-1 gap-8 md:grid-cols-4", columns.length > 3 && "expanded:grid-cols-5")}>
          <div>
            <span className="font-display text-xl text-foreground">{brand}</span>
            {tagline && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tagline}</p>}
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-foreground">{col.title}</h2>
              <ul className="mt-3 flex flex-col gap-1">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <As
                      href={link.href}
                      className="inline-flex min-h-9 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </As>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {legal && (
          <div className="mt-10 border-t border-border pt-6">
            <p className="text-center text-xs text-muted-foreground">{legal}</p>
          </div>
        )}
      </div>
    </footer>
  )
}

export interface BottomTab {
  id: string
  label: string
  icon: LucideIcon
  /** Destino; sin `href` el ítem es un botón y usa `onClick`. */
  href?: string
  onClick?: () => void
  /** Cifra sobre el ícono (p. ej. ítems de la bolsa). */
  badge?: number
}

const TAB_CLASS =
  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-primary aria-[current=page]:before:absolute aria-[current=page]:before:left-1/2 aria-[current=page]:before:top-0 aria-[current=page]:before:ml-[-0.75rem] aria-[current=page]:before:h-[3px] aria-[current=page]:before:w-6 aria-[current=page]:before:rounded-b-[3px] aria-[current=page]:before:bg-primary aria-[current=page]:before:content-['']"

/** Barra inferior de páginas públicas (solo compact, máx. 5 destinos): ícono sobre etiqueta y marca en el activo. */
function BottomTabBar({
  items, activeId, linkAs: As = "a", label = "Secciones", className,
}: { items: readonly BottomTab[]; activeId?: string; linkAs?: LinkAs; label?: string; className?: string }) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur medium:hidden",
        className,
      )}
    >
      <ul className="flex">
        {items.slice(0, 5).map(({ id, label: text, href, onClick, icon: Icon, badge }) => {
          const content = (
            <>
              <span className="relative">
                <Icon className="size-5" aria-hidden="true" />
                {badge ? (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground" aria-hidden="true">
                    {badge}
                  </span>
                ) : null}
              </span>
              {text}
            </>
          )
          return (
            <li key={id} className="flex flex-1">
              {href ? (
                <As href={href} aria-current={activeId === id ? "page" : undefined} className={TAB_CLASS}>{content}</As>
              ) : (
                <button type="button" onClick={onClick} aria-current={activeId === id ? "page" : undefined} className={TAB_CLASS}>{content}</button>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Página de acceso: marca, título (`<h1>`), bajada y el formulario/botones al centro. */
function AuthPage({
  logo, title, description, children, className,
}: { logo?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className={cn("w-full max-w-sm space-y-8", className)}>
        <div className="space-y-2 text-center">
          {logo && <div className="flex justify-center">{logo}</div>}
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  )
}

export { SiteBrand, SiteHeader, SectionIntro, SiteFooter, BottomTabBar, AuthPage }
