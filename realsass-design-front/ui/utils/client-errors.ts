/**
 * client-errors.ts — buffer de los últimos errores de la pantalla, para adjuntar a un reporte (ADR-027).
 *
 * Solo guarda texto corto de `error` y `unhandledrejection`; no toca la red ni el DOM. El back vuelve a sanear
 * (enmascara tokens) y el usuario ve qué se envía antes de aceptar.
 */
const MAX_ENTRIES = 20
const MAX_LENGTH = 300

const buffer: string[] = []
let installed = false

function push(text: string): void {
  buffer.push(text.slice(0, MAX_LENGTH))
  if (buffer.length > MAX_ENTRIES) buffer.shift()
}

/** Idempotente: se llama una vez al montar el botón de reportes. */
export function captureClientErrors(): void {
  if (installed || typeof window === "undefined") return
  installed = true
  window.addEventListener("error", (e) => push(e.message || "Error de script"))
  window.addEventListener("unhandledrejection", (e) => {
    const reason: unknown = e.reason
    push(reason instanceof Error ? reason.message : `Promesa rechazada: ${String(reason)}`)
  })
}

export function getRecentClientErrors(): string[] {
  return [...buffer]
}
