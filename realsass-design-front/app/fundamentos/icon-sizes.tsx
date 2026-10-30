import { Bell, Package, Search, ShoppingBag, Truck, User } from 'lucide-react'

const ICONS = [Search, ShoppingBag, Package, Truck, Bell, User] as const

export function IconSizes() {
  return (
    <div className="grid gap-4 medium:grid-cols-2">
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-xs text-muted-foreground">16 px inline</p>
        <p className="flex items-center gap-2 text-sm"><Search className="size-4" aria-hidden="true" /> Buscar pedidos</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-xs text-muted-foreground">20 px standalone</p>
        <ul className="flex gap-3">{ICONS.map((I, i) => <li key={i}><I className="size-5" aria-hidden="true" /></li>)}</ul>
      </div>
    </div>
  )
}
