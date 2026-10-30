'use client'

/**
 * Toast — avisos que confirman lo que ya pasó (welver.html → «Avisos»).
 * Prototipo local: cuando esté validado se porta a @real/ui (el Toaster de sonner no agrupa repetidos ni muestra la cuenta atrás).
 *
 *   toast.success('Pedido guardado')
 *   toast.error('No pudimos guardar', { description: 'Tus datos están a salvo.', action: { label: 'Reintentar', onClick } })
 *   const id = toast.loading('Subiendo…');  toast.success('Listo', { id })     // se actualiza en su sitio
 *
 * Reglas: máximo 4 a la vez (el resto espera en cola, los errores pasan primero) · los repetidos se agrupan (×3) ·
 * con acción duran el doble · se pausan al apuntar o enfocar · se descartan con ✕, Esc o deslizando · persistente = duration: Infinity.
 * Anatomía: icono · título · contador · descripción · acción · cerrar · barra de tiempo.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert, X } from 'lucide-react'

import { cn } from "@real/ui/utils"

export type ToastKind = 'default' | 'success' | 'info' | 'warning' | 'error' | 'loading'
export type ToastPosition = 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'

export interface ToastOptions {
  /** Con `id` un toast existente se actualiza en su sitio (cargando → listo). */
  id?: string | number
  description?: ReactNode
  /** Milisegundos; `Infinity` = persistente. Por defecto 4500 (9000 con acción). */
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface Item {
  id: string
  kind: ToastKind
  title: ReactNode
  description?: ReactNode
  action?: ToastOptions['action']
  duration: number
  count: number
  /** Cambia cuando el toast se repite o se actualiza: reinicia el temporizador y la barra. */
  stamp: number
  leaving: boolean
}

const MAX_VISIBLE = 4
const BASE_DURATION = 4500
const EXIT_MS = 220

let items: Item[] = []
let position: ToastPosition = 'bottom-center'
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

const keyOf = (kind: ToastKind, title: ReactNode, description: ReactNode) => `${kind}|${String(title)}|${String(description ?? '')}`

function add(kind: ToastKind, title: ReactNode, o: ToastOptions = {}): string {
  const duration = o.duration ?? (kind === 'loading' ? Infinity : o.action ? BASE_DURATION * 2 : BASE_DURATION)
  const existingById = o.id != null ? items.find((i) => i.id === String(o.id) && !i.leaving) : undefined
  if (existingById) {
    items = items.map((i) => (i === existingById ? { ...i, kind, title, description: o.description, action: o.action, duration: kind === 'loading' ? Infinity : duration, stamp: ++seq, count: 1 } : i))
    emit()
    return existingById.id
  }
  const same = o.id == null ? items.find((i) => !i.leaving && keyOf(i.kind, i.title, i.description) === keyOf(kind, title, o.description)) : undefined
  if (same) {
    items = items.map((i) => (i === same ? { ...i, count: i.count + 1, stamp: ++seq } : i))
    emit()
    return same.id
  }
  const id = o.id != null ? String(o.id) : `t${++seq}`
  items = [...items, { id, kind, title, description: o.description, action: o.action, duration, count: 1, stamp: ++seq, leaving: false }]
  emit()
  return id
}

function dismiss(id?: string | number) {
  const targets = id == null ? items.filter((i) => !i.leaving).map((i) => i.id) : [String(id)]
  if (targets.length === 0) return
  items = items.map((i) => (targets.includes(i.id) ? { ...i, leaving: true } : i))
  emit()
  setTimeout(() => { items = items.filter((i) => !targets.includes(i.id)); emit() }, EXIT_MS)
}

export const toast = Object.assign(
  (title: ReactNode, o?: ToastOptions) => add('default', title, o),
  {
    success: (title: ReactNode, o?: ToastOptions) => add('success', title, o),
    info: (title: ReactNode, o?: ToastOptions) => add('info', title, o),
    warning: (title: ReactNode, o?: ToastOptions) => add('warning', title, o),
    error: (title: ReactNode, o?: ToastOptions) => add('error', title, o),
    loading: (title: ReactNode, o?: ToastOptions) => add('loading', title, o),
    dismiss,
  },
)

export function setToastPosition(p: ToastPosition) { position = p; emit() }
export function useToastPosition(): ToastPosition { return useSyncExternalStore(subscribe, () => position, () => 'bottom-center') }

const EMPTY: Item[] = []
const useItems = () => useSyncExternalStore(subscribe, () => items, () => EMPTY)

const ICON: Record<ToastKind, { Icon: typeof Info; cls: string; bar: string; label: string }> = {
  default: { Icon: Info, cls: 'text-foreground', bar: 'bg-foreground', label: 'Aviso' },
  success: { Icon: CircleCheck, cls: 'text-success-ink', bar: 'bg-success', label: 'Éxito' },
  info: { Icon: Info, cls: 'text-primary', bar: 'bg-primary', label: 'Información' },
  warning: { Icon: TriangleAlert, cls: 'text-warning-ink', bar: 'bg-warning', label: 'Atención' },
  error: { Icon: OctagonX, cls: 'text-destructive-ink', bar: 'bg-destructive', label: 'Error' },
  loading: { Icon: LoaderCircle, cls: 'text-muted-foreground', bar: 'bg-muted-foreground', label: 'Cargando' },
}

function ToastCard({ item, top }: { item: Item; top: boolean }) {
  const [paused, setPaused] = useState(false)
  const [dx, setDx] = useState(0)
  const drag = useRef<{ x: number } | null>(null)
  const remaining = useRef(item.duration)
  const started = useRef(0)
  const { Icon, cls, bar, label } = ICON[item.kind]
  const timed = item.duration !== Infinity && item.kind !== 'loading'

  useEffect(() => { remaining.current = item.duration }, [item.stamp, item.duration])
  useEffect(() => {
    if (!timed || paused || item.leaving) return
    started.current = Date.now()
    const t = setTimeout(() => dismiss(item.id), Math.max(remaining.current, 0))
    return () => { clearTimeout(t); remaining.current -= Date.now() - started.current }
  }, [paused, item.stamp, item.id, item.leaving, timed])

  const onUp = () => {
    if (!drag.current) return
    drag.current = null
    if (Math.abs(dx) > 80) { try { navigator.vibrate?.(8) } catch { /* sin vibración */ } dismiss(item.id) }
    else setDx(0)
  }

  return (
    <li
      role={item.kind === 'error' ? 'alert' : 'status'}
      data-kind={item.kind}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onPointerDown={(e) => { if ((e.target as HTMLElement).closest('button')) return; drag.current = { x: e.clientX }; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerMove={(e) => { if (drag.current) setDx(e.clientX - drag.current.x) }}
      onPointerUp={onUp} onPointerCancel={onUp}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, opacity: dx ? Math.max(0.3, 1 - Math.abs(dx) / 240) : undefined, touchAction: 'pan-y' }}
      className={cn(
        'pointer-events-auto relative overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg',
        item.leaving ? (top ? 'ds-toast-out-up' : 'ds-toast-out') : top ? 'ds-toast-in-down' : 'ds-toast-in',
      )}
    >
      <div className="flex items-start gap-3 p-3 pr-2">
        <Icon className={cn('mt-0.5 size-5 shrink-0', cls, item.kind === 'loading' && 'animate-spin')} aria-hidden="true" />
        <span className="sr-only">{label}: </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium leading-snug">
            <span className="min-w-0 break-words">{item.title}</span>
            {item.count > 1 && <span className="shrink-0 rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground" aria-label={`${item.count} veces`}>×{item.count}</span>}
          </p>
          {item.description && <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>}
          {item.action && (
            <button
              type="button"
              onClick={() => { item.action!.onClick(); dismiss(item.id) }}
              className="mt-2 inline-flex min-h-9 items-center rounded-md px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring -ml-2"
            >
              {item.action.label}
            </button>
          )}
        </div>
        <button
          type="button" aria-label="Cerrar aviso" onClick={() => dismiss(item.id)}
          className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" />
        </button>
      </div>
      {timed && (
        <span
          key={item.stamp}
          aria-hidden="true"
          className={cn('ds-timebar absolute inset-x-0 bottom-0 h-0.5', bar)}
          style={{ ['--tt' as string]: `${item.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      )}
    </li>
  )
}

const POS: Record<ToastPosition, string> = {
  'bottom-center': 'medium:bottom-5 medium:left-1/2 medium:-translate-x-1/2',
  'bottom-left': 'medium:bottom-5 medium:left-5',
  'bottom-right': 'medium:bottom-5 medium:right-5',
  'top-center': 'medium:top-5 medium:left-1/2 medium:-translate-x-1/2',
  'top-left': 'medium:top-5 medium:left-5',
  'top-right': 'medium:top-5 medium:right-5',
}

/** Montar una vez en el layout raíz (`position` fija dónde aparecen en medium y expanded). En compact van siempre sobre la barra inferior. */
export function ToastViewport({ position }: { position?: ToastPosition } = {}) {
  const list = useItems()
  const pos = useToastPosition()
  useEffect(() => { if (position) setToastPosition(position) }, [position])
  const top = pos.startsWith('top')

  // Los errores pasan por delante; lo que excede el máximo espera en cola.
  const ordered = [...list].sort((a, b) => Number(b.kind === 'error') - Number(a.kind === 'error'))
  const visible = ordered.slice(0, MAX_VISIBLE)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const last = [...items].reverse().find((i) => !i.leaving)
      if (last) dismiss(last.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section
      aria-label="Notificaciones"
      className={cn(
        'pointer-events-none fixed z-[60] w-[min(24rem,calc(100vw-2rem))]',
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2',
        'medium:bottom-auto medium:left-auto medium:translate-x-0',
        POS[pos],
      )}
    >
      <ol className={cn('flex gap-2', top ? 'flex-col-reverse' : 'flex-col')}>
        {visible.map((i) => <ToastCard key={i.id} item={i} top={top} />)}
      </ol>
      {ordered.length > MAX_VISIBLE && (
        <p className="pointer-events-none mt-2 text-center text-xs text-muted-foreground" aria-live="polite">+{ordered.length - MAX_VISIBLE} en espera</p>
      )}
    </section>
  )
}
