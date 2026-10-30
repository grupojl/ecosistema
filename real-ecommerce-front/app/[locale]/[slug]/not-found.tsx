'use client'

// Se muestra cuando resolveStore() devuelve null o el producto no existe.
// Cliente a propósito: un not-found.tsx de servidor no recibe params, y el texto tiene que salir en el idioma de la URL
// (norte SEO: nada de UI hardcodeada en el storefront). useParams() sí trae { locale, slug } acá.
import Link from 'next/link'
import { Button, EmptyState, PageContainer } from '@real/ui'
import { useParams } from 'next/navigation'
import { getDictionary, isLocale, DEFAULT_LOCALE } from '@/lib/i18n'

export default function StoreNotFound() {
  const params = useParams<{ locale?: string }>()
  const locale = params.locale && isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
  const text = getDictionary(locale).notFound

  return (
    <PageContainer size="sm" className="flex min-h-dvh flex-col justify-center">
      <EmptyState
        title={text.title}
        description={`${text.body} ${text.hint}`}
        action={<Button asChild><Link href="/">{text.back}</Link></Button>}
      />
    </PageContainer>
  )
}
