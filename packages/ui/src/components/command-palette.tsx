"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog"
import { Kbd } from "./kbd"

/**
 * CommandPalette — «Búsqueda» de welver.html: buscar y ejecutar comandos.
 * Pantalla completa en compact (cabe el teclado virtual) y superior desde medium. Se abre con Ctrl/⌘ K
 * (`useCommandShortcut`). ARIA combobox/listbox: ↑ ↓ navegan, Enter ejecuta, Esc cierra.
 */
export interface Command {
  id: string
  label: string
  /** Categoría que se muestra a la derecha (p. ej. «Sección», «Acción»). */
  group?: string
  icon?: React.ReactNode
  /** Palabras extra por las que también se encuentra. */
  keywords?: string
  onSelect: () => void
}

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: readonly Command[]
  placeholder?: string
  /** Nombre accesible del diálogo. */
  label?: string
  emptyText?: string
}

/** Ctrl/⌘ K abre la paleta. Devuelve el texto del atajo según la plataforma, para mostrarlo en la UI. */
export function useCommandShortcut(onOpen: () => void): string {
  const [hint, setHint] = React.useState("Ctrl K")
  React.useEffect(() => {
    setHint(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K")
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpen() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onOpen])
  return hint
}

function CommandPalette({
  open, onOpenChange, commands, placeholder = "Buscar…", label = "Buscar", emptyText = "Sin resultados",
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.group ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q))
  }, [commands, query])

  React.useEffect(() => { setActive(0) }, [query])
  React.useEffect(() => { if (!open) setQuery("") }, [open])
  // La opción activa siempre queda a la vista al navegar con el teclado (la lista tiene scroll propio).
  React.useEffect(() => {
    if (open) document.getElementById(`cmd-opt-${active}`)?.scrollIntoView({ block: "nearest" })
  }, [active, open, results])

  const run = (c: Command) => { onOpenChange(false); c.onSelect() }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); run(results[active]!) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preset="search" className="gap-0 p-0">
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <DialogDescription className="sr-only">Escribe para filtrar; usa las flechas y Enter para ejecutar.</DialogDescription>
        <div className="flex items-center gap-3 border-b px-4 py-3 pr-14">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `cmd-opt-${active}` : undefined}
            aria-label={label}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="min-h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul id="cmd-list" role="listbox" aria-label="Resultados" className="max-h-[50dvh] scroll-py-2 overflow-y-auto overscroll-contain p-2">
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</li>
          ) : (
            results.map((c, i) => (
              <li
                key={c.id}
                id={`cmd-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onClick={() => run(c)}
                onPointerMove={() => setActive(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground [&_svg]:size-4"
                )}
              >
                <span className="flex items-center gap-2">{c.icon}{c.label}</span>
                {c.group && <span className="text-xs text-muted-foreground">{c.group}</span>}
              </li>
            ))
          )}
        </ul>
        <div className="hidden items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground medium:flex">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar</span>
          <span><Kbd>↵</Kbd> abrir</span>
          <span><Kbd>Esc</Kbd> cerrar</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { CommandPalette }
