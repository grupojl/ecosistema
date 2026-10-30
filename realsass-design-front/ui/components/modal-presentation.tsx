"use client"

/**
 * modal-presentation.tsx — las 5 presentaciones de modal y los tipos que las eligen por clase de tamaño
 * (welver.html → «Modales adaptables»). Lo usan Dialog, AlertDialog y Sheet: un solo lenguaje para todos los fronts.
 *
 *   center · sheet (hoja inferior) · side (panel lateral) · fullscreen · top (búsqueda)
 *
 * Cada modal declara su TIPO (`preset`) y el sistema elige la presentación según compact / medium / expanded.
 */
import * as React from "react"

import type { SizeClass } from "../hooks/use-size-class"

export type ModalPresentationName = "center" | "sheet" | "side" | "fullscreen" | "top"
export type ModalPresentation = Record<SizeClass, ModalPresentationName>
export type ModalSize = "sm" | "md" | "lg"

interface PresetConfig {
  presentation: ModalPresentation
  /** Ancho por defecto del panel. */
  size?: ModalSize
  /** Hoja alta (casi pantalla completa) en la presentación `sheet`. */
  tall?: boolean
}

const same = (p: ModalPresentationName): ModalPresentation => ({ compact: p, medium: p, expanded: p })

/** Tipos y cuándo usarlos (tabla «Tipos y cuándo usarlos» de welver.html). */
export const MODAL_PRESETS = {
  /** Confirmar algo irreversible. */
  alert:     { presentation: same("center"), size: "sm" },
  /** Editar o crear algo pequeño. */
  form:      { presentation: { compact: "sheet", medium: "center", expanded: "center" } },
  /** Elegir entre muchos elementos. */
  selection: { presentation: { compact: "sheet", medium: "center", expanded: "center" }, tall: true },
  /** Ver un elemento sin perder la lista. */
  detail:    { presentation: { compact: "fullscreen", medium: "side", expanded: "side" } },
  /** Refinar una lista. */
  filters:   { presentation: { compact: "sheet", medium: "side", expanded: "side" } },
  /** Crear algo con muchos campos. */
  longForm:  { presentation: { compact: "fullscreen", medium: "center", expanded: "center" }, size: "lg" },
  /** Buscar y ejecutar comandos. */
  search:    { presentation: { compact: "fullscreen", medium: "top", expanded: "top" } },
} as const satisfies Record<string, PresetConfig>

export type ModalPreset = keyof typeof MODAL_PRESETS

export interface ModalPresentationProps {
  /** Tipo de modal; define la presentación en cada clase de tamaño. Default `form`. */
  preset?: ModalPreset
  /** Cambia la presentación de alguna clase de tamaño respecto del tipo. */
  presentation?: Partial<ModalPresentation>
  /** Ancho del panel: sm 24rem · md 28rem · lg 40rem. */
  size?: ModalSize
  /** Hoja alta: casi toda la pantalla (una sola altura; no hay alturas intermedias). */
  tall?: boolean
}

export function resolveModal(props: ModalPresentationProps, sizeClass: SizeClass) {
  const cfg: PresetConfig = MODAL_PRESETS[props.preset ?? "form"]
  return {
    pres: props.presentation?.[sizeClass] ?? cfg.presentation[sizeClass],
    size: props.size ?? cfg.size,
    tall: props.tall ?? cfg.tall ?? false,
  }
}

/** Agarre de la hoja inferior: arrastrar hacia abajo cierra. Es un atajo; el botón de cerrar siempre está visible. */
export function ModalGrip() {
  const start = React.useRef<number | null>(null)
  const panelOf = (el: HTMLElement) => el.closest<HTMLElement>('[data-slot="modal"]')

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    start.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    const panel = panelOf(e.currentTarget)
    if (panel) panel.style.transition = "none"
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return
    const panel = panelOf(e.currentTarget)
    if (panel) panel.style.transform = `translateY(${Math.max(0, e.clientY - start.current)}px)`
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return
    const dy = e.clientY - start.current
    start.current = null
    const panel = panelOf(e.currentTarget)
    if (!panel) return
    panel.style.transition = "transform .2s var(--ease-out)"
    if (dy > 100) {
      panel.style.transform = "translateY(100%)"
      panel.style.animation = "none"
      window.setTimeout(() => panel.querySelector<HTMLElement>('[data-slot="modal-close"]')?.click(), 180)
    } else {
      panel.style.transform = ""
    }
  }

  return (
    <div
      data-slot="modal-grip" aria-hidden="true"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      <span />
    </div>
  )
}
