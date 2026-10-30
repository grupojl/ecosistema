'use client'

import { CircleCheck } from 'lucide-react'
import { Badge, Card, Checkbox, Progress } from '@/components/ui'
import { GUIDE } from '@/lib/data/guide'
import { useStore } from '@/lib/use-store'

export function GuideChecklist() {
  const [state, setState] = useStore<Record<string, boolean>>('guide', {})
  let done = 0, todo = 0, todoOk = 0
  GUIDE.forEach(([, , items], gi) => items.forEach(([, ok], ii) => { if (ok) done++; else { todo++; if (state[`${gi}.${ii}`]) todoOk++ } }))
  const total = done + todo
  return (
    <div className="space-y-4">
      <div className="grid gap-4 medium:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">En esta referencia</p>
          <p className="font-display text-3xl font-bold tabular-nums">{done}/{total}</p>
          <Progress className="mt-2" value={Math.round((done / total) * 100)} aria-label="Implementado en esta referencia" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pendiente al llevarlo a producción</p>
          <p className="font-display text-3xl font-bold tabular-nums">{todoOk}/{todo}</p>
          <Progress className="mt-2" value={todo ? Math.round((todoOk / todo) * 100) : 0} aria-label="Avance de producción" />
        </Card>
      </div>
      <div className="grid gap-4 expanded:grid-cols-2">
        {GUIDE.map(([name, , items], gi) => {
          const d = items.filter((i) => i[1]).length
          return (
            <Card key={name} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-semibold">{name}</h3>
                <Badge variant="secondary" className="tabular-nums">{d}/{items.length} hechos</Badge>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {items.map(([text, ok], ii) => {
                  const k = `${gi}.${ii}`
                  return ok ? (
                    <li key={k} className="flex gap-2 py-1"><CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /><span><span className="sr-only">Hecho: </span>{text}</span></li>
                  ) : (
                    <li key={k}>
                      <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1.5">
                        <Checkbox className="mt-0.5" checked={!!state[k]} onCheckedChange={(c) => setState((s) => ({ ...s, [k]: c === true }))} />
                        <span className={state[k] ? 'text-muted-foreground line-through' : undefined}><Badge variant="outline" className="mr-1.5 align-middle">Producción</Badge>{text}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
