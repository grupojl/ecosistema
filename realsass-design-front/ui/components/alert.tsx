"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react"

import { cn } from "@real/ui/utils"

/**
 * Alert — aviso en línea (welver.html → «Alert»). Cuatro intenciones: info, success, warning, destructive.
 * El ícono por defecto sale de la variante; el título usa las variantes `ink` (AA sobre fondo tintado).
 */
const alertVariants = cva(
  "relative flex w-full gap-3 rounded-lg border p-4 text-sm",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        info: "bg-background text-foreground",
        success: "border-success/40 bg-success/10",
        warning: "border-warning/50 bg-warning/10",
        destructive: "border-destructive/40 bg-destructive/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>

const GLYPH: Record<AlertVariant, { Icon: React.ElementType; icon: string; title: string }> = {
  default:     { Icon: Info,          icon: "text-primary",     title: "" },
  info:        { Icon: Info,          icon: "text-primary",     title: "" },
  success:     { Icon: CircleCheck,   icon: "text-success",     title: "text-success-ink" },
  warning:     { Icon: TriangleAlert, icon: "text-warning",     title: "text-warning-ink" },
  destructive: { Icon: OctagonAlert,  icon: "text-destructive", title: "text-destructive-ink" },
}

const AlertContext = React.createContext<AlertVariant>("default")

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Ícono propio; `null` lo oculta. Por defecto el de la variante. */
  icon?: React.ReactNode | null
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, children, ...props }, ref) => {
    const key: AlertVariant = variant ?? "default"
    const { Icon, icon: iconColor } = GLYPH[key]
    return (
      <AlertContext.Provider value={key}>
        <div
          ref={ref}
          role={key === "destructive" || key === "warning" ? "alert" : "status"}
          data-slot="alert"
          className={cn(alertVariants({ variant }), className)}
          {...props}
        >
          {icon === null ? null : (
            <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", iconColor)} aria-hidden="true">
              {icon ?? <Icon />}
            </span>
          )}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </AlertContext.Provider>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(AlertContext)
  return <h5 ref={ref} className={cn("font-medium leading-snug", GLYPH[variant].title, className)} {...props} />
})
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-muted-foreground [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription, alertVariants }
