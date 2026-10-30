import * as React from "react"
import { CircleAlert } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Label } from "./label"

/**
 * Field — etiqueta + control + ayuda + error de un campo de formulario (welver.html → «Form con validación»).
 * El error se anuncia (`role="alert"`) y se enlaza al control con `aria-describedby`; no depende solo del color.
 *
 *   <Field id="sku" label="SKU" error={errors.sku}>
 *     {(a11y) => <Input id="sku" {...a11y} />}
 *   </Field>
 */
export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  id: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  children: (a11y: { "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode
}

function Field({ id, label, hint, error, children, className, ...props }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ")
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

function FieldError({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p role="alert" className={cn("flex items-center gap-1 text-xs text-destructive-ink", className)} {...props}>
      <CircleAlert className="size-3 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

export { Field, FieldError }
