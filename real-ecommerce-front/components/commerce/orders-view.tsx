'use client'

/** Historial de pedidos del cliente de esta tienda (customer.orders). */
import Link from 'next/link'
import { Badge, Button, Card, EmptyState, LoadingState, PageContainer, PageHeader } from '@real/ui'
import { trpc } from '@/lib/trpc/client'
import { useCommerce } from '@/components/commerce/commerce-provider'
import { formatPrice } from '@/lib/catalog/product-view'

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'secondary' | 'outline'> = {
  PENDING_PAYMENT: 'warning',
  PAID:            'success',
  FULFILLING:      'secondary',
  SHIPPED:         'secondary',
  DELIVERED:       'success',
  CANCELLED:       'outline',
  REFUNDED:        'outline',
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

  if (!ready) return <LoadingState label={c.loading} />

  if (!customer) {
    return (
      <PageContainer size="sm">
        <PageHeader title={c.ordersTitle} />
        <EmptyState kind="forbidden" description={c.needSignIn} action={<Button onClick={openAuth}>{c.signIn}</Button>} />
      </PageContainer>
    )
  }

  return (
    <PageContainer size="md">
      <PageHeader title={c.ordersTitle} />

      {orders.isLoading && <LoadingState label={c.loading} />}
      {orders.error && <EmptyState kind="error" description={c.genericError} />}

      {orders.data?.length === 0 && (
        <EmptyState
          description={c.ordersEmpty}
          action={<Button asChild><Link href={`${basePath}/productos`}>{c.backToStore}</Link></Button>}
        />
      )}

      <ul className="space-y-4">
        {orders.data?.map((o) => (
          <li key={o.id}><Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{c.orderNumber} <span className="font-mono">#{o.id.slice(0, 8)}</span></p>
                <p className="text-xs text-muted-foreground">{date(o.createdAt)}</p>
              </div>
              <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>{statusLabel(o.status)}</Badge>
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
          </Card></li>
        ))}
      </ul>
    </PageContainer>
  )
}
