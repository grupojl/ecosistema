import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, PageHeader, SectionHeader } from '@/components/ui'
import { GROUPS } from '@/lib/sections'

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="Sistema de diseño Welver"
        description="Atención al ciudadano, clara y disponible las 24 horas. Una sola interfaz que se adapta al dispositivo: todo sale de @real/ui y los tokens viven en welver.css."
      />
      {GROUPS.map((g) => (
        <section key={g.label} className="space-y-3">
          <SectionHeader title={g.label} size="sm" />
          <ul className="grid gap-3 medium:grid-cols-2">
            {g.sections.map(({ id, label, description, icon: Icon }) => (
              <li key={id}>
                <Link href={`/${id}`} className="block h-full rounded-lg">
                  <Card className="flex h-full min-h-11 items-center gap-3 p-4 transition-colors hover:bg-accent">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground" aria-hidden="true"><Icon className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{label}</span>
                      <span className="block text-sm text-muted-foreground">{description}</span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
