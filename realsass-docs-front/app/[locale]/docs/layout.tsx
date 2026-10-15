import { DocsSidebar } from '@/components/docs/sidebar'
import { docs } from '@/lib/docs'
import { isLocale } from '@/lib/docs/types'
import { notFound } from 'next/navigation'

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const groups = await docs.getNavigation(locale)

  return (
    <div className="mx-auto flex max-w-[90rem] gap-10 px-4 sm:px-6">
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto py-8 pr-2 lg:block">
        <DocsSidebar locale={locale} groups={groups} />
      </aside>
      <main id="contenido" className="min-w-0 flex-1 py-10">
        {children}
      </main>
    </div>
  )
}
