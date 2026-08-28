/**
 * @real/ui — componentes shadcn compartidos
 *
 * Fuente única de componentes UI para los 3 fronts del ecosistema.
 * Instalados con: pnpm dlx shadcn@4.18.0 add --cwd packages/ui
 *
 * Los fronts importan así:
 *   import { Button } from '@real/ui'
 *   import { Dialog, DialogContent } from '@real/ui'
 *
 * Los shims en components/ui/ de cada front re-exportan desde acá
 * para mantener compatibilidad con imports @/components/ui/* existentes.
 */

// ── Utilidades ────────────────────────────────────────────────────────────────
export { cn } from './utils/cn'

// ── Componentes shadcn (33 componentes) ──────────────────────────────────────
export * from './components/accordion'
export * from './components/alert'
export * from './components/alert-dialog'
export * from './components/avatar'
export * from './components/badge'
export * from './components/button'
export * from './components/card'
export * from './components/checkbox'
export * from './components/collapsible'
export * from './components/dialog'
export * from './components/drawer'
export * from './components/dropdown-menu'
export * from './components/hover-card'
export * from './components/input'
export * from './components/label'
export * from './components/navigation-menu'
export * from './components/popover'
export * from './components/progress'
export * from './components/radio-group'
export * from './components/scroll-area'
export * from './components/select'
export * from './components/separator'
export * from './components/sheet'
export * from './components/skeleton'
export * from './components/slider'
export * from './components/sonner'
export * from './components/switch'
export * from './components/table'
export * from './components/tabs'
export * from './components/textarea'
export * from './components/toggle'
export * from './components/toggle-group'
export * from './components/tooltip'
