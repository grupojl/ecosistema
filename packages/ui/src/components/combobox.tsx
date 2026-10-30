"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Input } from "./input"

/**
 * Combobox — para más de ~7 opciones, donde filtrar ayuda (welver.html → «Combobox · Date»).
 * Con pocas opciones usa `NativeSelect`. Patrón ARIA combobox/listbox: ↑ ↓ mueven, Enter elige, Esc cierra,
 * y un `role="status"` anuncia la cantidad de resultados.
 */
export interface ComboboxOption {
  value: string
  label: string
}

export interface ComboboxProps {
  id: string
  options: readonly ComboboxOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  /** Nombre de la lista (para lectores de pantalla). */
  listLabel: string
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
}

function Combobox({
  id, options, value, onValueChange, listLabel, placeholder = "Escribe para filtrar…", emptyText = "Sin resultados",
  disabled, className, ...aria
}: ComboboxProps) {
  const selected = options.find((o) => o.value === value) ?? null
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const listId = `${id}-list`

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  React.useEffect(() => { setActive(0) }, [query, open])

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); setQuery("") }
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open])

  const choose = (o: ComboboxOption) => {
    onValueChange(o.value)
    setOpen(false)
    setQuery("")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); choose(results[active]!) }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); setQuery("") }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        className="pr-9"
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={onKeyDown}
        {...aria}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</li>
          ) : (
            results.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                onPointerMove={() => setActive(i)}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                {o.label}
                {o.value === value && <span className="text-xs text-muted-foreground">✓</span>}
              </li>
            ))
          )}
        </ul>
      )}
      <p className="sr-only" role="status">{open ? (results.length ? `${results.length} resultados` : emptyText) : ""}</p>
    </div>
  )
}

export { Combobox }
