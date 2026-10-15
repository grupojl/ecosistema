import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { KindBadge } from '@/components/docs/kind-badge'
import { Pager } from '@/components/docs/pager'
import { TableOfContents } from '@/components/docs/toc'
import { docs } from '@/lib/docs'
import { isLocale } from '@/lib/docs/types'
import { renderDoc } from '@/lib/markdoc/render'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const page = await docs.getPage(locale, slug.join('/'))
  if (!page) return {}
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${locale}/docs/${page.slug}` },
  }
}

export default async function DocPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  // null → 404. Cualquier otra falla lanza y devuelve 5xx (ADR-016).
  const page = await docs.getPage(locale, slug.join('/'))
  if (!page) notFound()

  const groups = await docs.getNavigation(locale)
  const flat = groups.flatMap((g) => g.items)
  const index = flat.findIndex((item) => item.slug === page.slug)
  const sectionTitle = groups.find((g) => g.section.key === page.section)?.section.title

  const { content, headings } = renderDoc(page.body)
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(page.updatedAt))

  return (
    <div className="flex gap-10">
      <article className="min-w-0 max-w-3xl flex-1">
        <header className="mb-8">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {sectionTitle ? <span>{sectionTitle}</span> : null}
            <KindBadge kind={page.kind} />
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">{page.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{page.description}</p>
        </header>

        <div className="docs-prose">{content}</div>

        <p className="mt-12 text-xs text-muted-foreground">Actualizado el {updated}</p>
        <Pager locale={locale} prev={flat[index - 1]} next={flat[index + 1]} />
      </article>

      <aside className="sticky top-20 hidden h-fit w-56 shrink-0 xl:block">
        <TableOfContents headings={headings} />
      </aside>
    </div>
  )
}
