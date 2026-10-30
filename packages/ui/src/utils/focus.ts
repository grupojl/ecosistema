/**
 * Al cerrar un modal, menú o popover, Radix devuelve el foco al botón que lo abrió. Si se cerró con Esc (teclado),
 * el navegador lo trata como foco de teclado y dibuja el aro sobre ese botón, aunque la persona no haya navegado.
 *
 * `quietRefocus()` marca el documento (`data-refocus`) para que welver.css no dibuje ese aro; la marca se quita en
 * cuanto la persona vuelve a interactuar (Tab, flechas o clic), y desde ahí el foco de teclado se ve con normalidad.
 */
export function quietRefocus() {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.setAttribute("data-refocus", "")
  const clear = () => {
    root.removeAttribute("data-refocus")
    window.removeEventListener("keydown", onKey, true)
    window.removeEventListener("pointerdown", clear, true)
  }
  const onKey = (e: KeyboardEvent) => { if (e.key !== "Escape") clear() }
  // Se registra tras el evento actual para que el Esc que cerró el modal no la quite enseguida.
  setTimeout(() => {
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("pointerdown", clear, true)
  }, 0)
}
