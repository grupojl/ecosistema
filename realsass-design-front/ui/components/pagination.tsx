"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Button } from "./button"

/**
 * Pagination — paginador de tablas y listas (welver.html → «Table»).
 * La página actual lleva `aria-current="page"`; anterior/siguiente se deshabilitan en los extremos.
 */
export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Etiqueta accesible del paginador. */
  label?: string
}

/** Páginas visibles con elipsis: 1 … 4 5 [6] 7 8 … 20 */
function windowOf(page: number, count: number): Array<number | "gap"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const pages = new Set<number>([1, count, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  const out: Array<number | "gap"> = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined && p - prev > 1) out.push("gap")
    out.push(p)
  })
  return out
}

function Pagination({ page, pageCount, onPageChange, label = "Paginación", className, ...props }: PaginationProps) {
  if (pageCount <= 1) return null
  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center gap-1", className)} {...props}>
      <Button variant="ghost" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft />
      </Button>
      {windowOf(page, pageCount).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden="true">…</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "secondary" : "ghost"}
            size="icon"
            aria-label={`Página ${p}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className="tabular-nums"
          >
            {p}
          </Button>
        )
      )}
      <Button variant="ghost" size="icon" aria-label="Página siguiente" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        <ChevronRight />
      </Button>
    </nav>
  )
}

export { Pagination }
