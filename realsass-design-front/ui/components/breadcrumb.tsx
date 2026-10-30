import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@real/ui/utils"

/**
 * Breadcrumb — a partir de 3 niveles de jerarquía (welver.html → «Avatar · Progress · Skeleton · Breadcrumb»).
 * El último elemento es la página actual (`aria-current="page"`). Cada enlace mide >= 44 px en compact y medium.
 */
export interface BreadcrumbItem {
  label: string
  /** Sin `href`: es la página actual. */
  href?: string
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: readonly BreadcrumbItem[]
  /** Componente de enlace de la app (p. ej. `next/link`). Por defecto, `<a>`. */
  linkAs?: React.ElementType
}

function Breadcrumb({ items, linkAs, className, ...props }: BreadcrumbProps) {
  const Link: React.ElementType = linkAs ?? "a"
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)} {...props}>
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-1 transition-colors hover:text-foreground expanded:min-h-0 expanded:min-w-0"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "font-medium text-foreground")}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Breadcrumb }
