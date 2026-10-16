// app/[locale]/[slug]/checkout/page.tsx — Finalizar compra (privada: no se indexa)
import { notFound } from 'next/navigation'
import { requireStore } from '@/lib/store'
import { getDictionary, isLocale } from '@/lib/i18n'
import { CheckoutView } from '@/components/commerce/checkout-view'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return { title: getDictionary(locale).commerce.checkoutTitle, robots: { index: false, follow: false } }
}

export default async function CheckoutPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const store = await requireStore(slug)

  return (
    <div className="container mx-auto px-4 py-8">
      <CheckoutView defaultCountry={store.countryCode} />
    </div>
  )
}
