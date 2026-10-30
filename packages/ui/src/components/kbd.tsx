import * as React from "react"

import { cn } from "@real/ui/utils"

/** Kbd — atajo de teclado en línea (`kbd` de welver.html). */
function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={cn("rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]", className)} {...props} />
}

export { Kbd }
