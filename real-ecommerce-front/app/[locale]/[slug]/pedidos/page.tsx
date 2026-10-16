// app/[locale]/[slug]/pedidos/page.tsx — Mis pedidos (privada: no se indexa)
import { notFound } from 'next/navigation'
import { getDictionary, isLocale } from '@/lib/i18n'
import { OrdersView } from '@/components/commerce/orders-view'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return { title: getDictionary(locale).commerce.ordersTitle, robots: { index: false, follow: false } }
}

export default async function PedidosPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <div className="container mx-auto px-4 py-8">
      <OrdersView />
    </div>
  )
}
