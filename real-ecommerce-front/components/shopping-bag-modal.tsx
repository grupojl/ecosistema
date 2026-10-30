"use client"

/**
 * Bolsa de la home genérica. Es un modal de @real/ui (`detail`: pantalla completa en compact, panel lateral desde medium):
 * se abre con el botón del header y se cierra con ✕, Esc o tocando fuera. Antes se pintaba siempre, abierta o no.
 */
import Link from "next/link"
import { Bookmark, CircleUser, ClipboardList, LogIn, ShoppingBag } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, EmptyState, SectionHeader } from "@real/ui"
import { useShoppingBagStore } from "@/stores/use-shopping-bag-store"

const PROFILE_LINKS = [
  { label: "Pedidos", href: "/tracking", icon: ClipboardList },
  { label: "Guardados", href: "#", icon: Bookmark },
  { label: "Cuenta", href: "#", icon: CircleUser },
  { label: "Ingresar", href: "#", icon: LogIn },
]

export default function ShoppingBagModal() {
  const { isOpen, close } = useShoppingBagStore()
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent preset="detail" size="sm">
        <DialogHeader>
          <DialogTitle>Tu bolsa</DialogTitle>
          <DialogDescription>Ingresa para ver si tienes productos guardados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 px-5 pb-6">
          <EmptyState icon={<ShoppingBag className="size-5" />} title="Tu bolsa está vacía" description="Cuando agregues productos, los verás acá." />
          <div className="space-y-2">
            <SectionHeader size="sm" title="Mi perfil" />
            <ul>
              {PROFILE_LINKS.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <Link href={href} onClick={close} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
