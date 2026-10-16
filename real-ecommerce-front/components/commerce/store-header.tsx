'use client'

/**
 * Navbar de la tienda: marca, navegación, idioma y un único AVATAR del cliente (ADR-021).
 * Desde el avatar se maneja todo lo del cliente de ESTA tienda: cuenta, bolsa (ítems, subtotal, checkout), pedidos y salir.
 * Sin sesión, el avatar es un ícono de persona que abre el ingreso con Google.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import { LocaleSwitcher } from '@/components/storefront/locale-switcher'
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

  useEffect(() => {
    if (!panel) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, setPanel])

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={homeHref} className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-7 rounded object-cover" />
          )}
          <span className="font-semibold text-sm tracking-tight truncate">{storeName}</span>
        </Link>

        <nav className="hidden sm:flex gap-6 text-sm text-muted-foreground">
          <Link href={homeHref} className="hover:text-foreground transition-colors">{dict.nav.home}</Link>
          <Link href={productsHref} className="hover:text-foreground transition-colors">{dict.nav.products}</Link>
        </nav>

        <div className="flex items-center gap-4">
          <LocaleSwitcher current={locale} label={dict.localeSwitcher.label} />

          {/* ── Avatar del cliente ─────────────────────────────────── */}
          <div className="relative">
            <button
              onClick={() => (customer ? setPanel(!panel) : openAuth())}
              aria-label={customer ? c.account : c.signIn} aria-expanded={customer ? panel : undefined}
              disabled={!ready}
              className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              {customer?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={customer.photoUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : customer ? (
                initialsOf(customer)
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              )}
            </button>
            {customer && bag.summary.count > 0 && (
              <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
                {bag.summary.count}
              </span>
            )}

            {customer && panel && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-hidden="true" tabIndex={-1} onClick={() => setPanel(false)} />
                <div className="absolute right-0 top-full z-50 mt-3 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
                  {/* Cuenta */}
                  <div className="px-5 py-4">
                    {customer.name && <p className="text-sm font-medium truncate">{customer.name}</p>}
                    <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                  </div>

                  {/* Bolsa */}
                  <div className="space-y-3 border-t border-border px-5 py-4">
                    <h2 className="text-sm font-semibold">{dict.store.bagTitle}</h2>
                    {bag.isLoading ? (
                      <p className="text-sm text-muted-foreground">{c.loading}</p>
                    ) : bag.lines.length === 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">{dict.store.bagEmpty}</p>
                        <Link href={productsHref} onClick={() => setPanel(false)} className="inline-block text-sm text-blue-500 hover:text-blue-400">
                          {dict.store.heroCta} →
                        </Link>
                      </>
                    ) : (
                      <>
                        <ul className="max-h-60 space-y-3 overflow-y-auto pr-1">
                          {bag.lines.map((l) => (
                            <li key={l.variantId} className="flex items-start justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{l.variant.product.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{l.variant.title} · ×{l.quantity}</p>
                                <button onClick={() => void bag.removeItem(l.variantId)} disabled={bag.removingId === l.variantId}
                                        className="mt-1 text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50">
                                  {c.remove}
                                </button>
                              </div>
                              <span className="shrink-0">{money(lineTotalCents(l), l.variant.currency)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
                          <span>{c.subtotal}</span>
                          <span>{bag.summary.currency ? money(bag.summary.subtotalCents, bag.summary.currency) : ''}</span>
                        </div>
                        <Link href={`${basePath}/checkout`} onClick={() => setPanel(false)}
                              className="block w-full rounded-full bg-blue-500 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-600">
                          {c.checkout}
                        </Link>
                      </>
                    )}
                  </div>

                  {/* Pedidos y salir */}
                  <div className="border-t border-border p-2">
                    <Link href={`${basePath}/pedidos`} onClick={() => setPanel(false)}
                          className="block rounded px-3 py-2 text-sm transition-colors hover:bg-accent">
                      {c.myOrders}
                    </Link>
                    <button onClick={() => void signOut()}
                            className="block w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent">
                      {c.signOut}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
