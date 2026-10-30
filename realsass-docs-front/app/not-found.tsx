import Link from 'next/link'
import { Button, EmptyState } from '@real/ui'
import { getRequestLocale } from '@real/i18n/server'
import { getDictionary } from '@/lib/i18n'

export default async function NotFound() {
  const locale = await getRequestLocale()
  const d = getDictionary(locale)
  return (
    <div lang={locale}>
    <EmptyState
      title={d.docs.notFoundTitle}
      description={d.docs.notFoundBody}
      action={<Button asChild variant="outline"><Link href="/">{d.docs.backToHelp}</Link></Button>}
    />
    </div>
  )
}
