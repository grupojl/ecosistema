import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { DocNavItem, Locale } from '@/lib/docs/types'

/** Anterior / Siguiente (Stripe Docs). */
export function Pager({ locale, prev, next }: { locale: Locale; prev?: DocNavItem; next?: DocNavItem }) {
  if (!prev && !next) return null
  return (
    <nav aria-label="Páginas vecinas" className="mt-16 grid gap-4 border-t pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          href={`/${locale}/docs/${prev.slug}`}
          className="group rounded-lg border p-4 transition-colors hover:bg-accent/50"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3.5" aria-hidden /> Anterior
          </span>
          <span className="mt-1 block font-medium">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/${locale}/docs/${next.slug}`}
          className="group rounded-lg border p-4 text-right transition-colors hover:bg-accent/50"
        >
          <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            Siguiente <ArrowRight className="size-3.5" aria-hidden />
          </span>
          <span className="mt-1 block font-medium">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  )
}
