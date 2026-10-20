'use client'
import { useEffect, useState } from 'react'

/**
 * true cuando la imagen ya está descargada (o falló, o pasó el tiempo máximo), para mostrarla ya pintada y no ver
 * primero las iniciales y después "saltar" a la foto. Sin `src` no hay nada que esperar.
 */
export function useImageReady(src: string | null | undefined, timeoutMs = 1500): boolean {
  const [ready, setReady] = useState(!src)

  useEffect(() => {
    if (!src) { setReady(true); return }
    setReady(false)

    let finished = false
    const finish = () => { if (!finished) { finished = true; setReady(true) } }

    const img = new Image()
    img.referrerPolicy = 'no-referrer' // las fotos de Google se rechazan con referrer
    img.onload  = finish
    img.onerror = finish // si falla, el avatar muestra las iniciales; no se queda esperando
    img.src = src
    if (img.complete) finish()
    const timer = setTimeout(finish, timeoutMs) // red lenta: no bloquear el navbar por una foto

    return () => { finished = true; clearTimeout(timer); img.onload = null; img.onerror = null }
  }, [src, timeoutMs])

  return ready
}
