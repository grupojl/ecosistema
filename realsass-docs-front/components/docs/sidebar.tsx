'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@real/ui'
import type { DocNavGroup, Locale } from '@/lib/docs/types'

interface SidebarProps {
  locale: Locale
  groups: DocNavGroup[]
  /** Se invoca al navegar; el menú móvil lo usa para cerrarse. */
  onNavigate?: () => void
}

export function DocsSidebar({ locale, groups, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Documentación" className="space-y-6 text-sm">
      {groups.map(({ section, items }) => (
        <div key={section.key}>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {items.map((item) => {
              const href = `/${locale}/docs/${item.slug}`
              const active = pathname === href
              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-2 py-1.5 transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
