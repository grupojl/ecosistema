'use client'

/**
 * Checkout de la tienda: dirección de envío → customer.checkout (reserva stock y crea el pedido).
 * El pago en línea todavía no existe: el pedido queda "pendiente de pago" y la tienda coordina el cobro.
 */
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Button, Field, Input, Label, Alert, EmptyState, LoadingState, PageContainer, PageHeader, SectionHeader } from '@real/ui'
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

  if (!ready) return <LoadingState label={c.loading} />

  // ── Pedido confirmado ──────────────────────────────────────────────
  if (placed) {
    return (
      <PageContainer size="sm" className="text-center">
        <PageHeader title={c.orderPlacedTitle} className="text-center" />
        <p className="text-sm text-muted-foreground">
          {c.orderNumber} <span className="font-mono">#{placed.id.slice(0, 8)}</span> · {money(placed.totalCents, placed.currency)}
        </p>
        <p className="text-muted-foreground">{t(c.orderPlacedBody, { store: storeName })}</p>
        <div className="flex justify-center gap-3 pt-2">
          <Button asChild><Link href={`${basePath}/pedidos`}>
            {c.myOrders}
          </Link></Button>
          <Button asChild variant="outline"><Link href={basePath}>
            {c.backToStore}
          </Link></Button>
        </div>
      </PageContainer>
    )
  }

  // ── Sin ingresar ───────────────────────────────────────────────────
  if (!customer) {
    return (
      <PageContainer size="sm">
        <PageHeader title={c.checkoutTitle} />
        <EmptyState kind="forbidden" description={c.needSignIn} action={<Button onClick={openAuth}>{c.signIn}</Button>} />
      </PageContainer>
    )
  }

  if (bag.isLoading) return <LoadingState label={c.loading} />

  // ── Bolsa vacía ────────────────────────────────────────────────────
  if (bag.lines.length === 0) {
    return (
      <PageContainer size="sm">
        <PageHeader title={c.checkoutTitle} />
        <EmptyState
          title={dict.store.bagEmpty}
          description=" "
          action={<Button asChild><Link href={`${basePath}/productos`}>{c.backToStore}</Link></Button>}
        />
      </PageContainer>
    )
  }

  const currency = bag.summary.currency ?? 'USD'

  return (
    <PageContainer size="xl">
      <PageHeader title={c.checkoutTitle} />

      <div className="grid medium:grid-cols-5 gap-10">
        <form onSubmit={onSubmit} className="medium:col-span-3 space-y-5">
          <SectionHeader title={c.shippingTitle} />

          <Field id="co-street" label={c.street}>{(a11y) => <Input id="co-street" required autoComplete="street-address" value={form.street} onChange={set('street')} {...a11y} />}</Field>
          <div className="grid medium:grid-cols-2 gap-4">
            <Field id="co-city" label={c.city}>{(a11y) => <Input id="co-city" required autoComplete="address-level2" value={form.city} onChange={set('city')} {...a11y} />}</Field>
            <Field id="co-state" label={c.state}>{(a11y) => <Input id="co-state" autoComplete="address-level1" value={form.state} onChange={set('state')} {...a11y} />}</Field>
            <Field id="co-zip" label={c.postalCode}>{(a11y) => <Input id="co-zip" required autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} {...a11y} />}</Field>
            <Field id="co-country" label={c.country}>{(a11y) => <Input id="co-country" required maxLength={2} autoComplete="country" value={form.country} onChange={set('country')} {...a11y} />}</Field>
          </div>

          {bag.mixedCurrency && <Alert variant="destructive">{c.genericError}</Alert>}
          {error && <Alert variant="destructive">{error}</Alert>}

          <Button type="submit" className="w-full" disabled={checkout.isPending || bag.mixedCurrency}>
            {checkout.isPending ? c.placingOrder : `${c.placeOrder} · ${money(bag.summary.subtotalCents, currency)}`}
          </Button>
        </form>

        <aside className="medium:col-span-2 space-y-4">
          <SectionHeader title={c.summary} />
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
    </PageContainer>
  )
}
