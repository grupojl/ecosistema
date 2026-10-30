'use client'

import { Card, Checkbox, Progress } from '@/components/ui'
import { DOD } from '@/lib/data/system'
import { useStore } from '@/lib/use-store'

export function DefinitionOfDone() {
  const [done, setDone] = useStore<Record<string, boolean>>('dod', {})
  const total = DOD.reduce((a, [, items]) => a + items.length, 0)
  const count = Object.values(done).filter(Boolean).length
  return (
    <div className="space-y-4">
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium tabular-nums" aria-live="polite">{count} de {total}</p>
        <Progress value={Math.round((count / total) * 100)} aria-label="Definición de hecho" />
      </div>
      <div className="grid gap-4 medium:grid-cols-2">
        {DOD.map(([group, items], gi) => (
          <Card key={group} className="p-4">
            <p className="mb-2 font-display font-semibold">{group}</p>
            <ul className="space-y-0.5 text-sm">
              {items.map((text, ii) => {
                const k = `${gi}.${ii}`
                return (
                  <li key={k}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1.5">
                      <Checkbox className="mt-0.5" checked={!!done[k]} onCheckedChange={(c) => setDone((d) => ({ ...d, [k]: c === true }))} />
                      <span>{text}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
