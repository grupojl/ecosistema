import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { KindBadge } from '@/components/docs/kind-badge'
import { docs } from '@/lib/docs'
import { KIND_META } from '@/lib/docs/kinds'
import { DOC_KINDS, isLocale } from '@/lib/docs/types'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Guías, tutoriales y referencia para usar y extender el ecosistema.',
}

export default async function DocsHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const groups = await docs.getNavigation(locale)
  const first = groups[0]?.items[0]

  return (
    <div className="mx-auto max-w-4xl">
      <section className="pb-10">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Documentación</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Todo lo que necesitás para usar el ecosistema: desde crear tu organización hasta integrarlo con tus propios
          sistemas.
        </p>
        {first ? (
          <Link
            href={`/${locale}/docs/${first.slug}`}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Empezar <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </section>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Todavía no hay documentación publicada en este idioma.
        </p>
      ) : null}

      <section aria-labelledby="que-buscas" className="py-6">
        <h2 id="que-buscas" className="text-xl font-semibold">
          ¿Qué necesitás hoy?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Cada página indica con una etiqueta qué tipo de lectura es.</p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {DOC_KINDS.map((kind) => (
            <li key={kind} className="rounded-xl border bg-card p-5">
              <KindBadge kind={kind} />
              <p className="mt-3 font-medium">{KIND_META[kind].question}</p>
              <p className="mt-1 text-sm text-muted-foreground">{KIND_META[kind].description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="secciones" className="py-8">
        <h2 id="secciones" className="text-xl font-semibold">
          Secciones
        </h2>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          {groups.map(({ section, items }) => (
            <div key={section.key}>
              <h3 className="font-semibold">{section.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
              <ul className="mt-3 space-y-2 border-l pl-4">
                {items.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/${locale}/docs/${item.slug}`} className="text-sm hover:text-primary hover:underline">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
