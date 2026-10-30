import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@real/ui/utils"

/**
 * Stepper — flujos lineales de 3 a 5 pasos: checkout, alta (welver.html → «Stepper»).
 * Indica «Paso X de Y»; el paso actual lleva `aria-current="step"`. El estado nunca depende solo del color.
 */
export interface StepperProps extends React.HTMLAttributes<HTMLElement> {
  steps: readonly string[]
  /** Índice (desde 0) del paso actual. */
  current: number
  label?: string
}

function Stepper({ steps, current, label = "Progreso", className, ...props }: StepperProps) {
  return (
    <nav aria-label={label} className={className} {...props}>
      <p className="mb-2 text-xs text-muted-foreground medium:hidden" aria-live="polite">
        Paso {Math.min(current + 1, steps.length)} de {steps.length}: <span className="font-medium text-foreground">{steps[current]}</span>
      </p>
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={step} className={cn("flex items-center", i < steps.length - 1 && "flex-1")} aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold tabular-nums",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-accent text-accent-foreground",
                  !done && !active && "border-input text-muted-foreground"
                )}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                <span className="sr-only">{done ? "completado: " : active ? "actual: " : ""}{step}</span>
              </span>
              <span className={cn("ml-2 hidden text-sm medium:inline", active ? "font-medium text-foreground" : "text-muted-foreground")} aria-hidden="true">
                {step}
              </span>
              {i < steps.length - 1 && <span className={cn("mx-3 h-px flex-1", done ? "bg-primary" : "bg-border")} aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Stepper }
