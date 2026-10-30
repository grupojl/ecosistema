"use client"

/**
 * AppShell — «Navegación adaptable» de welver.html: misma información y mismas rutas, solo cambia la forma.
 *
 *   Compact  (< 600 px)   barra superior + barra inferior (máx. 4 destinos + «Más» con todo lo demás)
 *   Medium   (600–839)    riel de íconos
 *   Expanded (>= 840)     barra lateral completa y colapsable
 *
 * Los tres se generan desde UNA lista de destinos (`groups`). Todo objetivo táctil mide >= 44 px.
 */
import * as React from "react"
import { Ellipsis, PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Badge } from "./badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"

export interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  /** Abre fuera de la app (otra pestaña). */
  external?: boolean
  /** Destino aún no disponible: se muestra atenuado con la etiqueta `hint`. */
  disabled?: boolean
  hint?: string
  /** Contador (p. ej. pedidos nuevos). */
  badge?: number
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export type AccountVariant = "sidebar" | "rail" | "sheet"

export interface AppShellProps {
  brand: { name: string; mark?: React.ReactNode }
  groups: NavGroup[]
  /** hrefs que van en la barra inferior (máx. 4). Por defecto, los 4 primeros destinos habilitados. */
  tabs?: string[]
  isActive: (href: string) => boolean
  /** Componente de enlace de la app (p. ej. `next/link`). Por defecto, `<a>`. */
  linkAs?: React.ElementType
  /** Zona de cuenta: pie de la barra lateral / riel y parte baja de la hoja «Más». */
  account?: (variant: AccountVariant) => React.ReactNode
  /** Acciones de la barra superior (solo compact). */
  topbarActions?: React.ReactNode
  /** Etiqueta accesible del landmark principal. */
  navLabel?: string
  children: React.ReactNode
}

const COLLAPSE_KEY = "sidebar-collapsed"
const MAX_TABS = 4

function useCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = React.useState(false)
  React.useEffect(() => {
    try { setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1") } catch { /* sin almacenamiento: queda expandida */ }
  }, [])
  const set = (v: boolean) => {
    setCollapsed(v)
    try { window.localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0") } catch { /* idem */ }
  }
  return [collapsed, set]
}

function NavLink({
  item, active, linkAs, className, children, onNavigate,
}: {
  item: NavItem
  active: boolean
  linkAs?: React.ElementType
  className: string
  children: React.ReactNode
  onNavigate?: () => void
}) {
  const Comp: React.ElementType = item.external ? "a" : (linkAs ?? "a")
  const extra = item.external ? { target: "_blank", rel: "noopener noreferrer" } : {}
  return (
    <Comp
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-disabled={item.disabled || undefined}
      tabIndex={item.disabled ? -1 : undefined}
      onClick={item.disabled ? (e: React.MouseEvent) => e.preventDefault() : onNavigate}
      className={cn(className, item.disabled && "pointer-events-none opacity-50")}
      {...extra}
    >
      {children}
    </Comp>
  )
}

const ICON = "[&_svg]:size-5 [&_svg]:shrink-0"

export function AppShell({
  brand, groups, tabs, isActive, linkAs, account, topbarActions, navLabel = "Principal", children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useCollapsed()
  const [moreOpen, setMoreOpen] = React.useState(false)

  const all = React.useMemo(() => groups.flatMap((g) => g.items), [groups])
  const tabItems = React.useMemo(() => {
    const chosen = tabs
      ? tabs.map((h) => all.find((i) => i.href === h)).filter((i): i is NavItem => Boolean(i))
      : all.filter((i) => !i.disabled && !i.external)
    return chosen.slice(0, MAX_TABS)
  }, [all, tabs])
  const activeInTabs = tabItems.some((i) => isActive(i.href))

  return (
    <div className="flex min-h-dvh bg-background">
      {/* ── Riel (medium) y barra lateral (expanded) ─────────────────────────── */}
      <aside
        aria-label="Navegación"
        data-collapsed={collapsed}
        className="group/sb sticky top-0 hidden h-dvh w-16 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 medium:flex expanded:w-60 expanded:data-[collapsed=true]:w-16"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground [&_svg]:size-4">
            {brand.mark ?? brand.name.slice(0, 1)}
          </span>
          <span className="hidden truncate font-display font-bold expanded:group-data-[collapsed=false]/sb:inline">{brand.name}</span>
        </div>

        <nav aria-label={navLabel} className="flex-1 space-y-4 overflow-y-auto p-2">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground expanded:group-data-[collapsed=false]/sb:block">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item} active={isActive(item.href)} linkAs={linkAs}
                      className={cn(
                        "relative flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground",
                        ICON
                      )}
                    >
                      <span title={item.label} className="relative">
                        {item.icon}
                        {!!item.badge && (
                          <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground" aria-hidden="true">
                            {item.badge}
                          </span>
                        )}
                      </span>
                      <span className="sr-only flex-1 truncate expanded:group-data-[collapsed=false]/sb:not-sr-only">{item.label}</span>
                      {item.hint && (
                        <Badge variant="secondary" className="hidden px-1.5 py-0 text-[10px] expanded:group-data-[collapsed=false]/sb:inline-flex">{item.hint}</Badge>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t p-2">
          {account && (
            <>
              <div className="expanded:group-data-[collapsed=false]/sb:block hidden">{account("sidebar")}</div>
              <div className="block expanded:group-data-[collapsed=false]/sb:hidden">{account("rail")}</div>
            </>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            className={cn(
              "hidden min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground expanded:flex",
              ICON
            )}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            <span className="hidden expanded:group-data-[collapsed=false]/sb:inline">Colapsar</span>
            <span className="sr-only">{collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Barra superior (solo compact) ──────────────────────────────────── */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur medium:hidden">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground [&_svg]:size-4">
            {brand.mark ?? brand.name.slice(0, 1)}
          </span>
          <span className="truncate font-display font-bold">{brand.name}</span>
          <div className="ml-auto flex items-center gap-1">{topbarActions}</div>
        </header>

        <main id="main" className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] medium:pb-0">
          {children}
        </main>
      </div>

      {/* ── Barra inferior (solo compact) ──────────────────────────────────────── */}
      <nav
        aria-label={navLabel}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur medium:hidden"
      >
        <ul className="flex">
          {tabItems.map((item) => (
            <li key={item.href} className="flex flex-1">
              <NavLink item={item} active={isActive(item.href)} linkAs={linkAs} className={tabClass}>
                <span className="relative">
                  {item.icon}
                  {!!item.badge && (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground" aria-hidden="true">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-current={!activeInTabs && all.some((i) => isActive(i.href)) ? "page" : undefined}
              className={tabClass}
            >
              <Ellipsis className="size-5" />
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ── «Más»: todos los destinos y la cuenta, en hoja alta ─────────────────── */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent preset="selection">
          <DialogHeader>
            <DialogTitle>Secciones</DialogTitle>
          </DialogHeader>
          <nav aria-label="Todas las secciones" className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        item={item} active={isActive(item.href)} linkAs={linkAs} onNavigate={() => setMoreOpen(false)}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground",
                          ICON
                        )}
                      >
                        {item.icon}
                        <span className="flex-1">{item.label}</span>
                        {item.hint && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{item.hint}</Badge>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          {account && <div className="space-y-1 border-t pt-3">{account("sheet")}</div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Destino de la barra inferior: ícono sobre etiqueta y marca superior en el activo (patrón `bn-item` de welver.html). */
const tabClass = cn(
  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-primary",
  "aria-[current=page]:before:absolute aria-[current=page]:before:left-1/2 aria-[current=page]:before:top-0 aria-[current=page]:before:ml-[-0.75rem] aria-[current=page]:before:h-[3px] aria-[current=page]:before:w-6 aria-[current=page]:before:rounded-b-[3px] aria-[current=page]:before:bg-primary aria-[current=page]:before:content-['']"
)
