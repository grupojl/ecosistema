"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Button } from "./button"

/**
 * QuantityStepper — elegir una cantidad entera con − / + (carrito, bolsa). Objetivos táctiles de 44 px.
 *
 *   <QuantityStepper value={qty} onValueChange={setQty} min={1} max={10} label="Cantidad" />
 */
export interface QuantityStepperProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  label: string
  decreaseLabel?: string
  increaseLabel?: string
}

function QuantityStepper({
  value, onValueChange, min = 1, max = 99, label, decreaseLabel = "-", increaseLabel = "+", className, ...props
}: QuantityStepperProps) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-lg border bg-card", className)} {...props}>
      <Button type="button" variant="ghost" size="icon" aria-label={decreaseLabel} disabled={value <= min}
        onClick={() => onValueChange(Math.max(min, value - 1))}>
        <Minus aria-hidden="true" />
      </Button>
      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">{value}</span>
      <Button type="button" variant="ghost" size="icon" aria-label={increaseLabel} disabled={value >= max}
        onClick={() => onValueChange(Math.min(max, value + 1))}>
        <Plus aria-hidden="true" />
      </Button>
    </div>
  )
}

export { QuantityStepper }
