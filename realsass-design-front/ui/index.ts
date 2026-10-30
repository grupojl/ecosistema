/**
 * @real/ui — componentes shadcn compartidos
 *
 * Fuente única de componentes UI para los fronts del ecosistema.
 *
 * ⚠ ESTE ARCHIVO SE GENERA: la fuente es realsass-design-front/ui. No se edita acá;
 *   se cambia allá y se migra con  pnpm ui:migrate  (ver .claude/modules/packages/ui-migracion.md).
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
export { THEME_COLOR } from './utils/theme-color'
export { captureClientErrors, getRecentClientErrors } from './utils/client-errors'
export { useSizeClass, type SizeClass } from './hooks/use-size-class'

// ── Componentes shadcn (33 componentes) ──────────────────────────────────────
export * from './components/accordion'
export * from './components/action-menu'
export * from './components/alert'
export * from './components/breadcrumb'
export * from './components/empty-state'
export * from './components/field'
export * from './components/kbd'
export * from './components/native-select'
export * from './components/language-switcher'
export * from './components/page'
export * from './components/pagination'
export * from './components/segmented-control'
export * from './components/site'
export * from './components/quantity-stepper'
export * from './components/prose'
export * from './components/stepper'
export * from './components/alert-dialog'
export * from './components/app-shell'
export * from './components/avatar'
export * from './components/badge'
export * from './components/button'
export * from './components/card'
export * from './components/chart'
export * from './components/checkbox'
export * from './components/collapsible'
export * from './components/combobox'
export * from './components/command-palette'
export * from './components/date-input'
export * from './components/devices-dialog'
export * from './components/feedback-dialog'
export * from './components/dialog'
export * from './components/modal-presentation'
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
export * from './components/theme'
export * from './components/toast'
export * from './components/charts-extra'
export * from './components/brand-icons'
export * from './components/login-panel'
export * from './components/toggle'
export * from './components/toggle-group'
export * from './components/tooltip'
