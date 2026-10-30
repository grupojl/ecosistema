"use client"

import * as React from "react"

import { cn } from "@real/ui/utils"

/**
 * SegmentedControl — elegir una opción entre pocas, mutuamente excluyentes (`seg` de welver.html).
 * Cada botón usa `aria-pressed`; el grupo lleva una etiqueta accesible.
 */
export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
}

export interface SegmentedControlProps<T extends string> extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  "aria-label": string
}

function SegmentedControl<T extends string>({ value, onValueChange, options, className, ...props }: SegmentedControlProps<T>) {
  return (
    <div role="group" className={cn("inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-md bg-muted p-1 text-sm", className)} {...props}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onValueChange(o.value)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export { SegmentedControl }
