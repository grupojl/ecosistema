'use client'

/**
 * Navbar de la tienda: marca, navegación, idioma y un único AVATAR del cliente (ADR-021).
 * Desde el avatar se maneja todo lo del cliente de ESTA tienda: cuenta, bolsa (ítems, subtotal, checkout), pedidos y salir.
 * Sin sesión, el avatar es un ícono de persona que abre el ingreso con Google.
 *
 * El panel es un modal de @real/ui (`detail`): pantalla completa en compact, panel lateral desde medium. Foco atrapado,
 * Esc y «atrás» lo cierran; el foco vuelve al avatar.
 */
import Link from 'next/link'
import { House, ShoppingBag, Store, User, UserRound } from 'lucide-react'
import { LocaleSwitcher } from '@/components/storefront/locale-switcher'
import {
  Avatar, AvatarFallback, AvatarImage, BottomTabBar, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  EmptyState, SectionHeader, Separator, SiteBrand, SiteHeader, ThemeToggle,
} from '@real/ui'
import { useCommerce } from '@/components/commerce/commerce-provider'
import { useBag } from '@/components/commerce/use-bag'
import { formatPrice } from '@/lib/catalog/product-view'
import { initialsOf } from '@/lib/commerce/storage'
import { lineTotalCents } from '@/lib/commerce/cart-math'

interface StoreHeaderProps {
  storeName: string
  logoUrl:   string | null
}

export function StoreHeader({ storeName, logoUrl }: StoreHeaderProps) {
  const { dict, locale, basePath, intlTag, customer, ready, panel, setPanel, openAuth, signOut } = useCommerce()
  const bag = useBag()
  const c = dict.commerce
  const homeHref = basePath
  const productsHref = `${basePath}/productos`
  const money = (cents: number, currency: string) => formatPrice(cents, currency, intlTag)
  const count = customer ? bag.summary.count : 0

  return (
    <>
    <SiteHeader
      navLabel={dict.nav.products}
      linkAs={Link}
      brand={<SiteBrand name={storeName} logoUrl={logoUrl} href={homeHref} linkAs={Link} />}
      links={[
        { id: 'home', label: dict.nav.home, href: homeHref },
        { id: 'products', label: dict.nav.products, href: productsHref },
      ]}
      actions={
        <>
          <LocaleSwitcher current={locale} label={dict.localeSwitcher.label} />
          <ThemeToggle compact />

          {/* ── Avatar del cliente ─────────────────────────────────── */}
          <div className="relative">
            <Button
              type="button" variant="ghost" size="icon"
              onClick={() => (customer ? setPanel(true) : openAuth())}
              aria-label={customer ? `${c.account}${count ? ` (${count})` : ''}` : c.signIn}
              aria-haspopup={customer ? 'dialog' : undefined}
              disabled={!ready}
              className="rounded-full"
            >
              <Avatar className="size-8">
                {customer?.photoUrl && <AvatarImage src={customer.photoUrl} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                  {customer ? initialsOf(customer) : <UserRound className="size-4" aria-hidden="true" />}
                </AvatarFallback>
              </Avatar>
            </Button>
            {count > 0 && (
              <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary-solid px-1 text-[10px] font-semibold tabular-nums text-white">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </div>
        </>
      }
    />

    {customer && (
      <Dialog open={panel} onOpenChange={setPanel}>
        <DialogContent preset="detail" size="sm">
          <DialogHeader>
            <DialogTitle>{customer.name || c.account}</DialogTitle>
            <DialogDescription className="truncate">{customer.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-5 pb-4">
            <section aria-labelledby="bag-title" className="space-y-3">
              <SectionHeader id="bag-title" size="sm" title={dict.store.bagTitle} />
              {bag.isLoading ? (
                <p className="text-sm text-muted-foreground" role="status">{c.loading}</p>
              ) : bag.lines.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag className="size-5" />}
                  title={dict.store.bagEmpty}
                  action={<Button asChild variant="outline" size="sm" className="mt-1"><Link href={productsHref} onClick={() => setPanel(false)}>{dict.store.heroCta}</Link></Button>}
                />
              ) : (
                <>
                  <ul className="divide-y rounded-lg border">
                    {bag.lines.map((l) => (
                      <li key={l.variantId} className="flex items-start justify-between gap-3 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{l.variant.product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{l.variant.title} · ×{l.quantity}</p>
                          <Button
                            type="button" variant="link" size="sm" onClick={() => void bag.removeItem(l.variantId)}
                            disabled={bag.removingId === l.variantId} className="mt-1 h-auto min-h-0 p-0 text-xs"
                          >
                            {c.remove}
                          </Button>
                        </div>
                        <span className="shrink-0 font-display font-semibold tabular-nums">{money(lineTotalCents(l), l.variant.currency)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.subtotal}</span>
                    <span className="font-display text-lg font-bold tabular-nums">{bag.summary.currency ? money(bag.summary.subtotalCents, bag.summary.currency) : ''}</span>
                  </div>
                  <Button asChild className="w-full"><Link href={`${basePath}/checkout`} onClick={() => setPanel(false)}>{c.checkout}</Link></Button>
                </>
              )}
            </section>

            <Separator />

            <nav aria-label={c.account} className="space-y-1">
              <Link href={`${basePath}/pedidos`} onClick={() => setPanel(false)} className="flex min-h-11 items-center rounded-md px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                {c.myOrders}
              </Link>
              <Button type="button" variant="ghost" onClick={() => void signOut()} className="w-full justify-start px-3 font-normal">
                {c.signOut}
              </Button>
            </nav>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Compact: barra inferior (patrón bn-item de welver.html) */}
    <BottomTabBar
      label="Principal"
      linkAs={Link}
      items={[
        { id: 'home', label: dict.nav.home, icon: House, href: homeHref },
        { id: 'products', label: dict.nav.products, icon: Store, href: productsHref },
        { id: 'bag', label: dict.store.bagTitle, icon: ShoppingBag, badge: count, onClick: () => (customer ? setPanel(true) : openAuth()) },
        { id: 'account', label: customer ? c.account : c.signIn, icon: User, onClick: () => (customer ? setPanel(true) : openAuth()) },
      ]}
    />
    </>
  )
}
