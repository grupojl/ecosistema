'use client'

// Se muestra cuando resolveStore() devuelve null o el producto no existe.
// Cliente a propósito: un not-found.tsx de servidor no recibe params, y el texto tiene que salir en el idioma de la URL
// (norte SEO: nada de UI hardcodeada en el storefront). useParams() sí trae { locale, slug } acá.
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getDictionary, isLocale, DEFAULT_LOCALE } from '@/lib/i18n'

export default function StoreNotFound() {
  const params = useParams<{ locale?: string }>()
  const locale = params.locale && isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
  const text = getDictionary(locale).notFound

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-4xl font-bold">{text.title}</h1>
      <p className="text-muted-foreground text-lg">{text.body}</p>
      <p className="text-sm text-muted-foreground max-w-sm">{text.hint}</p>
      <Link href="/" className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
        {text.back}
      </Link>
    </div>
  )
}
