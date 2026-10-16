'use client'

/**
 * Checkout de la tienda: dirección de envío → customer.checkout (reserva stock y crea el pedido).
 * El pago en línea todavía no existe: el pedido queda "pendiente de pago" y la tienda coordina el cobro.
 */
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Button, Input, Label } from '@real/ui'
import { trpc } from '@/lib/trpc/client'
import { useCommerce } from '@/components/commerce/commerce-provider'
import { useBag } from '@/components/commerce/use-bag'
import { formatPrice } from '@/lib/catalog/product-view'
import { t } from '@/lib/i18n'
import { lineTotalCents } from '@/lib/commerce/cart-math'

interface Placed { id: string; totalCents: number; currency: string }

/** Los errores del back vienen como texto del dominio ("Stock insuficiente…") o, en validaciones, como un JSON de Zod. */
function readable(message: string | undefined, fallback: string): string {
  if (!message || message.trimStart().startsWith('[') || message.trimStart().startsWith('{')) return fallback
  return message
}

export function CheckoutView({ defaultCountry }: { defaultCountry: string }) {
  const { dict, locale, basePath, intlTag, storeName, customer, ready, cartId, setCartId, openAuth } = useCommerce()
  const bag = useBag()
  const utils = trpc.useUtils()
  const checkout = trpc.customer.checkout.useMutation()
  const c = dict.commerce
  const money = (cents: number, currency: string) => formatPrice(cents, currency, intlTag)

  const [form, setForm] = useState({ street: '', city: '', state: '', postalCode: '', country: defaultCountry })
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<Placed | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cartId) return
    setError(null)
    try {
      const order = await checkout.mutateAsync({
        cartId,
        locale,
        shippingAddress: {
          street: form.street.trim(), city: form.city.trim(), postalCode: form.postalCode.trim(),
          country: form.country.trim().toUpperCase(), ...(form.state.trim() ? { state: form.state.trim() } : {}),
        },
      })
      setPlaced({ id: order.id, totalCents: order.totalCents, currency: order.currency })
      setCartId(null)
      void utils.customer.orders.invalidate()
    } catch (err) {
      setError(readable(err instanceof Error ? err.message : undefined, c.genericError))
    }
  }

  if (!ready) return <p className="text-sm text-muted-foreground">{c.loading}</p>

  // ── Pedido confirmado ──────────────────────────────────────────────
  if (placed) {
    return (
      <div className="max-w-xl mx-auto text-center space-y-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{c.orderPlacedTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {c.orderNumber} <span className="font-mono">#{placed.id.slice(0, 8)}</span> · {money(placed.totalCents, placed.currency)}
        </p>
        <p className="text-muted-foreground">{t(c.orderPlacedBody, { store: storeName })}</p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href={`${basePath}/pedidos`} className="rounded-full bg-blue-500 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-colors">
            {c.myOrders}
          </Link>
          <Link href={basePath} className="rounded-full border border-border px-6 py-2 text-sm font-semibold hover:bg-accent transition-colors">
            {c.backToStore}
          </Link>
        </div>
      </div>
    )
  }

  // ── Sin ingresar ───────────────────────────────────────────────────
  if (!customer) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-16">
        <h1 className="text-2xl font-bold tracking-tight">{c.checkoutTitle}</h1>
        <p className="text-muted-foreground">{c.needSignIn}</p>
        <Button onClick={openAuth}>{c.signIn}</Button>
      </div>
    )
  }

  if (bag.isLoading) return <p className="text-sm text-muted-foreground">{c.loading}</p>

  // ── Bolsa vacía ────────────────────────────────────────────────────
  if (bag.lines.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-16">
        <h1 className="text-2xl font-bold tracking-tight">{c.checkoutTitle}</h1>
        <p className="text-muted-foreground">{dict.store.bagEmpty}</p>
        <Link href={`${basePath}/productos`} className="inline-block rounded-full bg-blue-500 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-colors">
          {c.backToStore}
        </Link>
      </div>
    )
  }

  const currency = bag.summary.currency ?? 'USD'

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-8">{c.checkoutTitle}</h1>

      <div className="grid md:grid-cols-5 gap-10">
        <form onSubmit={onSubmit} className="md:col-span-3 space-y-5">
          <h2 className="text-lg font-semibold">{c.shippingTitle}</h2>

          <div className="space-y-2">
            <Label htmlFor="co-street">{c.street}</Label>
            <Input id="co-street" required autoComplete="street-address" value={form.street} onChange={set('street')} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="co-city">{c.city}</Label>
              <Input id="co-city" required autoComplete="address-level2" value={form.city} onChange={set('city')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-state">{c.state}</Label>
              <Input id="co-state" autoComplete="address-level1" value={form.state} onChange={set('state')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-zip">{c.postalCode}</Label>
              <Input id="co-zip" required autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-country">{c.country}</Label>
              <Input id="co-country" required maxLength={2} autoComplete="country" value={form.country} onChange={set('country')} />
            </div>
          </div>

          {bag.mixedCurrency && <p role="alert" className="text-sm text-destructive">{c.genericError}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={checkout.isPending || bag.mixedCurrency}>
            {checkout.isPending ? c.placingOrder : `${c.placeOrder} · ${money(bag.summary.subtotalCents, currency)}`}
          </Button>
        </form>

        <aside className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">{c.summary}</h2>
          <ul className="space-y-3">
            {bag.lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{l.variant.product.name}</p>
                  <p className="text-xs text-muted-foreground">{l.variant.title} · ×{l.quantity}</p>
                </div>
                <span className="shrink-0">{money(lineTotalCents(l), l.variant.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-border pt-3 font-semibold">
            <span>{c.subtotal}</span>
            <span>{money(bag.summary.subtotalCents, currency)}</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
