'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button, Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@real/ui'
import type { DocNavGroup, Locale } from '@/lib/docs/types'
import { DocsSidebar } from './sidebar'

export function MobileNav({ locale, groups }: { locale: Locale; groups: DocNavGroup[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegación">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetTitle>Documentación</SheetTitle>
        <SheetDescription className="sr-only">Navegación entre las páginas de la documentación</SheetDescription>
        <div className="mt-6">
          <DocsSidebar locale={locale} groups={groups} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
