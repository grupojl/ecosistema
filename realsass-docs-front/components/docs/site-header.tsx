import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { DocNavGroup, Locale } from '@/lib/docs/types'
import { MobileNav } from './mobile-nav'
import { ThemeToggle } from './theme'

export function SiteHeader({ locale, groups }: { locale: Locale; groups: DocNavGroup[] }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-2 px-4 sm:px-6">
          <MobileNav locale={locale} groups={groups} />
          <Link href={`/${locale}/docs`} className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="size-4" aria-hidden />
            </span>
            Docs
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </header>
    </>
  )
}
