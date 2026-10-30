import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, PageHeader } from '@real/ui'
import { getRequestLocale } from '@real/i18n/server'
import { listDocs } from '@/lib/docs'
import { getDictionary } from '@/lib/i18n'

export default async function HomePage() {
  const docs = await listDocs()
  const d = getDictionary(await getRequestLocale())
  return (
    <>
      <PageHeader title={d.docs.helpTitle} description={d.docs.helpIntro} />
      <ul lang="es" className="space-y-2">
        {docs.map((d) => (
          <li key={d.slug}>
            <Link href={`/${d.slug}`} className="block rounded-lg">
              <Card className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent">
                <span className="font-medium">{d.title}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
