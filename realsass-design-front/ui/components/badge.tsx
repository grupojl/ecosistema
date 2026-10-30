import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@real/ui/utils"

/**
 * Badge — etiqueta de estado corta. Siempre texto (el color solo no basta); `dot` suma un punto de estado.
 * Rellenos suaves con filete del mismo tono (nunca solo color), y la «default» comparte el esmalte de los botones.
 */
const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-semibold leading-4 tracking-[.01em] transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-[color-mix(in_srgb,var(--primary-solid)_70%,black)] bg-primary-solid text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/.22)]",
        secondary: "border-border bg-secondary text-secondary-foreground",
        destructive: "border-destructive/30 bg-destructive/12 text-destructive-ink",
        success: "border-success/30 bg-success/12 text-success-ink",
        warning: "border-warning/40 bg-warning/18 text-warning-ink",
        outline: "border-input bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Punto de estado a la izquierda (toma el color del texto). */
  dot?: boolean
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
