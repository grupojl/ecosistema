import * as React from "react"

import { cn } from "@real/ui/utils"

/** Marcador de carga con forma conocida: barrido de luz suave (shimmer). Con movimiento reducido queda fijo. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("relative overflow-hidden rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
