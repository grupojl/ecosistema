'use client'

/** Barra inferior (solo compact): máx. 5 destinos; el resto de secciones se alcanza desde el inicio. */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House } from 'lucide-react'
import { BottomTabBar } from '@/components/ui'
import { SECTIONS } from '@/lib/sections'

export function DesignNav() {
  const pathname = usePathname()
  const active = pathname === '/' ? 'home' : pathname.split('/')[1]
  return (
    <BottomTabBar
      label="Sistema de diseño"
      linkAs={Link}
      activeId={active}
      items={[
        { id: 'home', label: 'Inicio', icon: House, href: '/' },
        ...SECTIONS.slice(0, 4).map((s) => ({ id: s.id, label: s.label, icon: s.icon, href: `/${s.id}` })),
      ]}
    />
  )
}
