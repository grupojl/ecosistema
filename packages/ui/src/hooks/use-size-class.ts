"use client"

/**
 * use-size-class.ts — clase de tamaño de la ventana (norte UI/UX, ADR-024).
 *
 * compact < 600 px · medium 600–839 px · expanded >= 840 px. Son los únicos puntos de corte del sistema
 * (los mismos que `medium` y `expanded` de welver.html). Se actualiza sola al girar el dispositivo o
 * redimensionar, incluso con un modal abierto.
 */
import { useSyncExternalStore } from "react"

export type SizeClass = "compact" | "medium" | "expanded"

export const MEDIUM_MIN = 600
export const EXPANDED_MIN = 840

function read(): SizeClass {
  if (typeof window === "undefined") return "expanded"
  if (window.matchMedia(`(min-width: ${EXPANDED_MIN}px)`).matches) return "expanded"
  if (window.matchMedia(`(min-width: ${MEDIUM_MIN}px)`).matches) return "medium"
  return "compact"
}

function subscribe(onChange: () => void): () => void {
  const queries = [`(min-width: ${MEDIUM_MIN}px)`, `(min-width: ${EXPANDED_MIN}px)`].map((q) => window.matchMedia(q))
  queries.forEach((q) => q.addEventListener("change", onChange))
  return () => queries.forEach((q) => q.removeEventListener("change", onChange))
}

export function useSizeClass(): SizeClass {
  return useSyncExternalStore(subscribe, read, () => "expanded")
}
