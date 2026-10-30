'use client'

/** Barra inferior (solo compact) con las guías del centro de ayuda; la activa sigue a la ruta. */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, FileText, House, LifeBuoy, MessageCircle, MonitorSmartphone, type LucideIcon } from 'lucide-react'
import { BottomTabBar } from '@real/ui'
import { useMessages } from '@real/i18n'
import type { Dictionary } from '@/lib/i18n'

const ICONS: Record<string, LucideIcon> = {
  empezar: BookOpen,
  'informar-un-problema': LifeBuoy,
  whatsapp: MessageCircle,
  dispositivos: MonitorSmartphone,
}

export function DocsNav({ docs }: { docs: ReadonlyArray<{ slug: string; title: string }> }) {
  const pathname = usePathname()
  const d = useMessages<Dictionary>()
  const active = pathname === '/' ? 'home' : pathname.replace(/^\//, '')
  return (
    <BottomTabBar
      label={d.docs.navLabel}
      linkAs={Link}
      activeId={active}
      items={[
        { id: 'home', label: d.docs.home, icon: House, href: '/' },
        ...docs.slice(0, 4).map((d) => ({ id: d.slug, label: d.title, icon: ICONS[d.slug] ?? FileText, href: `/${d.slug}` })),
      ]}
    />
  )
}
