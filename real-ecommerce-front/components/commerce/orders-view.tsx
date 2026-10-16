'use client'

/** Historial de pedidos del cliente de esta tienda (customer.orders). */
import Link from 'next/link'
import { Button } from '@real/ui'
import { trpc } from '@/lib/trpc/client'
import { useCommerce } from '@/components/commerce/commerce-provider'
import { formatPrice } from '@/lib/catalog/product-view'

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  PAID:            'bg-green-100 text-green-800',
  FULFILLING:      'bg-blue-100 text-blue-800',
  SHIPPED:         'bg-blue-100 text-blue-800',
  DELIVERED:       'bg-green-100 text-green-800',
  CANCELLED:       'bg-gray-200 text-gray-700',
  REFUNDED:        'bg-gray-200 text-gray-700',
}

function addressLine(address: Record<string, unknown> | null): string {
  if (!address) return ''
  return ['street', 'city', 'state', 'postalCode', 'country']
    .map((k) => address[k])
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(', ')
}

export function OrdersView() {
  const { dict, basePath, intlTag, locale, customer, ready, openAuth } = useCommerce()
  const c = dict.commerce
  const orders = trpc.customer.orders.useQuery(undefined, { enabled: !!customer })
  const money = (cents: number, currency: string) => formatPrice(cents, currency, intlTag)
  const date = (d: Date | string) => new Intl.DateTimeFormat(intlTag, { dateStyle: 'medium' }).format(new Date(d))
  const statusLabel = (s: string) => (c.status as Record<string, string>)[s] ?? s

  if (!ready) return <p className="text-sm text-muted-foreground">{c.loading}</p>

  if (!customer) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-16">
        <h1 className="text-2xl font-bold tracking-tight">{c.ordersTitle}</h1>
        <p className="text-muted-foreground">{c.needSignIn}</p>
        <Button onClick={openAuth}>{c.signIn}</Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{c.ordersTitle}</h1>

      {orders.isLoading && <p className="text-sm text-muted-foreground">{c.loading}</p>}
      {orders.error && <p role="alert" className="text-sm text-destructive">{c.genericError}</p>}

      {orders.data?.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">{c.ordersEmpty}</p>
          <Link href={`${basePath}/productos`} className="inline-block rounded-full bg-blue-500 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-colors">
            {c.backToStore}
          </Link>
        </div>
      )}

      <ul className="space-y-4">
        {orders.data?.map((o) => (
          <li key={o.id} className="rounded-xl border border-border p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{c.orderNumber} <span className="font-mono">#{o.id.slice(0, 8)}</span></p>
                <p className="text-xs text-muted-foreground">{date(o.createdAt)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[o.status] ?? 'bg-gray-200 text-gray-700'}`}>
                {statusLabel(o.status)}
              </span>
            </div>

            <ul className="space-y-1 text-sm">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span className="truncate">{i.variant.product.name} <span className="text-muted-foreground">· {i.variant.title} · ×{i.quantity}</span></span>
                  <span className="shrink-0">{money(i.unitPriceCentsSnapshot * i.quantity, o.currency)}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border pt-3 text-sm">
              {addressLine(o.shippingAddress) && (
                <p className="text-xs text-muted-foreground">{c.shipTo}: {addressLine(o.shippingAddress)}</p>
              )}
              <p className="ml-auto font-semibold" lang={locale}>{c.total}: {money(o.totalCents, o.currency)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
