import * as React from "react"
import { Inbox, Lock, OctagonAlert, RotateCcw } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Button } from "./button"

/**
 * EmptyState — los estados no felices de toda vista con datos (norte, pilar 6): vacío, error con reintento y sin permisos.
 * (El cuarto estado, cargando, se resuelve con `Skeleton` y `aria-busy` en el contenedor.)
 */
type Kind = "empty" | "error" | "forbidden"

const KINDS: Record<Kind, { Icon: React.ElementType; tone: string; border: string; title: string; body: string }> = {
  empty: {
    Icon: Inbox, tone: "bg-muted text-muted-foreground", border: "border-dashed",
    title: "Todavía no hay nada acá", body: "Cuando haya datos, los vas a ver en este lugar.",
  },
  error: {
    Icon: OctagonAlert, tone: "bg-destructive/10 text-destructive-ink", border: "",
    title: "No pudimos cargar los datos", body: "Fue un problema de conexión. Tus datos están a salvo.",
  },
  forbidden: {
    Icon: Lock, tone: "bg-muted text-muted-foreground", border: "border-dashed",
    title: "No tenés acceso a este módulo", body: "Tu rol no lo incluye. Pedí acceso al propietario.",
  },
}

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  kind?: Kind
  title?: React.ReactNode
  description?: React.ReactNode
  /** Ícono propio; por defecto el del tipo. */
  icon?: React.ReactNode
  /** Solo en `error`: muestra «Reintentar». */
  onRetry?: () => void
  /** Acción propia (reemplaza a «Reintentar»). */
  action?: React.ReactNode
}

function EmptyState({ kind = "empty", title, description, icon, onRetry, action, className, ...props }: EmptyStateProps) {
  const cfg = KINDS[kind]
  const { Icon } = cfg
  return (
    <div
      role={kind === "error" ? "alert" : undefined}
      className={cn("flex flex-col items-center gap-2 rounded-lg border p-6 text-center", cfg.border, className)}
      {...props}
    >
      <span className={cn("grid size-12 place-items-center rounded-full", cfg.tone)} aria-hidden="true">
        {icon ?? <Icon className="size-5" />}
      </span>
      <p className="font-medium">{title ?? cfg.title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description ?? cfg.body}</p>
      {action ?? (kind === "error" && onRetry && (
        <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
          <RotateCcw /> Reintentar
        </Button>
      ))}
    </div>
  )
}

export { EmptyState }
