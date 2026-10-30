'use client'

/**
 * Cascarón del sistema de diseño: AppShell (barra inferior / riel / barra lateral desde UNA lista de destinos),
 * paleta de comandos (Ctrl/⌘ K) y ayuda de atajos (?).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { House, Keyboard, Palette, Search } from 'lucide-react'
import {
  AppShell, Button, CommandPalette, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Kbd, PageContainer, ThemeToggle, useCommandShortcut, type Command, type NavGroup,
} from '@/components/ui'
import { GROUPS, SECTIONS } from '@/lib/sections'

const NAV: NavGroup[] = [
  { label: 'Inicio', items: [{ href: '/', label: 'Inicio', icon: <House /> }] },
  ...GROUPS.map((g) => ({
    label: g.label,
    items: g.sections.map((s) => ({ href: `/${s.id}`, label: s.label, icon: <s.icon /> })),
  })),
]

const SHORTCUTS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Buscar secciones y acciones', ['Ctrl/⌘ K']],
  ['Mostrar esta ayuda', ['?']],
  ['Cerrar modal, menú o tooltip', ['Esc']],
  ['Cambiar de tab, recorrer un gráfico', ['←', '→']],
  ['Moverte por menús y listas', ['↑', '↓']],
  ['Ir al primer o último elemento', ['Inicio', 'Fin']],
  ['Activar el elemento enfocado', ['Enter', 'Espacio']],
  ['Pasar al siguiente o anterior control', ['Tab', 'Shift Tab']],
]

export function DesignShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const hint = useCommandShortcut(openSearch)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null
      const typing = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing && !document.querySelector('[role="dialog"]')) {
        e.preventDefault()
        setHelpOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const commands: Command[] = [
    ...SECTIONS.map((s) => ({
      id: s.id, label: s.label, group: 'Sección', icon: <s.icon className="size-4" />, keywords: s.description,
      onSelect: () => router.push(`/${s.id}`),
    })),
    { id: 'help', label: 'Atajos de teclado', group: 'Acción', icon: <Keyboard className="size-4" />, keywords: 'ayuda teclado shortcuts', onSelect: () => setHelpOpen(true) },
  ]

  return (
    <>
      <AppShell
        brand={{ name: 'Welver · Diseño', mark: <Palette /> }}
        groups={NAV}
        tabs={['/', '/componentes', '/modales', '/avisos']}
        linkAs={Link}
        isActive={(href) => (href === '/' ? pathname === '/' : pathname.startsWith(href))}
        navLabel="Sistema de diseño"
        topbarActions={
          <>
            <Button variant="ghost" size="icon" aria-label="Buscar" onClick={openSearch}><Search /></Button>
            <ThemeToggle compact />
          </>
        }
        account={() => (
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <Button size="sm" variant="outline" onClick={openSearch}><Search /> Buscar <Kbd>{hint}</Kbd></Button>
            <ThemeToggle compact />
          </div>
        )}
      >
        <div className="min-h-dvh bg-background"><PageContainer>{children}</PageContainer></div>
      </AppShell>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} commands={commands} placeholder="Buscar secciones y acciones…" label="Buscar" />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent preset="form">
          <DialogHeader>
            <DialogTitle>Atajos de teclado</DialogTitle>
            <DialogDescription>Todo lo que se hace con atajo también se puede hacer sin él.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 px-6 pb-2 text-sm">
            {SHORTCUTS.map(([what, keys]) => (
              <div key={what} className="flex items-center justify-between gap-3">
                <dt>{what}</dt>
                <dd className="flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</dd>
              </div>
            ))}
          </dl>
          <DialogFooter><Button onClick={() => setHelpOpen(false)}>Entendido</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
