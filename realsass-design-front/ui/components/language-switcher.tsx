"use client"

import * as React from "react"
import { Check, Globe } from "lucide-react"

import { ActionMenu } from "./action-menu"
import { Button } from "./button"

export interface LanguageOption {
  value: string
  /** Nombre del idioma en su propio idioma («Português»): no se traduce. */
  label: string
}

export interface LanguageSwitcherProps {
  value: string
  options: readonly LanguageOption[]
  onChange: (value: string) => void
  /** Nombre del selector, traducido («Idioma»): título de la hoja en compact y etiqueta accesible. */
  label: string
  /** Solo el ícono, sin el nombre del idioma (barras angostas). */
  compact?: boolean
}

/**
 * LanguageSwitcher — selector de idioma. Agnóstico de i18n: recibe el valor y `onChange`.
 * Es un `ActionMenu`: hoja de acciones en compact, popover desde medium.
 * El cableado con el idioma real (cookie + refresco) vive en `LocaleSwitcher` de @real/i18n.
 */
function LanguageSwitcher({ value, options, onChange, label, compact = false }: LanguageSwitcherProps) {
  const current = options.find((o) => o.value === value)
  return (
    <ActionMenu
      title={label}
      items={options.map((o) => ({
        label: o.label,
        icon: o.value === value ? <Check /> : undefined,
        disabled: o.value === value,
        onSelect: () => onChange(o.value),
      }))}
    >
      <Button variant="ghost" size="sm" aria-label={`${label}: ${current?.label ?? value}`}>
        <Globe aria-hidden="true" />
        {compact ? null : <span>{current?.label ?? value}</span>}
      </Button>
    </ActionMenu>
  )
}

export { LanguageSwitcher }
