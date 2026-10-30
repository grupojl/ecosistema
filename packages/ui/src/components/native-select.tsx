import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@real/ui/utils"

/**
 * NativeSelect — `<select>` nativo con la piel de `.input` de welver.html.
 * Úsalo para listas cortas y filtros: en celular abre el selector del sistema (mejor que un popover).
 * Para listas largas o con búsqueda, `Select` (Radix) o un combobox.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        data-slot="input"
        className={cn(
          "flex h-10 w-full appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-9 text-sm transition-[color,box-shadow,border-color] focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:ring-destructive",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  )
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
