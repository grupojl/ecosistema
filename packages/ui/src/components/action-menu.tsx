"use client"

import * as React from "react"

import { cn } from "@real/ui/utils"
import { useSizeClass } from "../hooks/use-size-class"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./dropdown-menu"

/**
 * ActionMenu — «Menú adaptable» de welver.html: las acciones de un elemento (o un orden).
 * Compact: hoja de acciones con filas grandes. Medium y expanded: popover anclado al botón.
 * Mismas acciones en ambos; `destructive` las marca con el color de peligro.
 */
export interface ActionMenuItem {
  label: string
  icon?: React.ReactNode
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  /** Línea separadora antes de esta acción. */
  separatorBefore?: boolean
}

export interface ActionMenuProps {
  /** Nombre del menú: título de la hoja en compact. */
  title: string
  items: readonly ActionMenuItem[]
  /** Botón que lo abre (se renderiza con `asChild`, en un único elemento). */
  children: React.ReactElement
  align?: "start" | "center" | "end"
}

function ActionMenu({ title, items, children, align = "end" }: ActionMenuProps) {
  const sizeClass = useSizeClass()
  const [open, setOpen] = React.useState(false)

  if (sizeClass === "compact") {
    return (
      <>
        {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          onClick: () => setOpen(true),
          "aria-haspopup": "dialog",
        })}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent preset="form">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium text-muted-foreground">{title}</DialogTitle>
            </DialogHeader>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => { setOpen(false); item.onSelect() }}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
                      item.destructive && "text-destructive-ink"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} aria-label={title}>
        {items.map((item) => (
          <React.Fragment key={item.label}>
            {item.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(item.destructive && "text-destructive-ink focus:text-destructive-ink")}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ActionMenu }
