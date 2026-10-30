'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui'
import { MOTION_CURVES } from '@/lib/data/system'

/** Compara las curvas: cada punto recorre la misma distancia con una curva distinta. */
export function CurveRace() {
  const [go, setGo] = useState(false)
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Curvas (compáralas)</p>
        <Button size="sm" variant="outline" onClick={() => { setGo(false); requestAnimationFrame(() => requestAnimationFrame(() => setGo(true))) }}>
          <Play /> Reproducir
        </Button>
      </div>
      <ul className="space-y-3">
        {MOTION_CURVES.map(([name, curve]) => (
          <li key={name} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
            <span className="font-mono text-muted-foreground">{name}</span>
            <span className="relative h-2 rounded-full bg-muted [container-type:inline-size]">
              <span
                className="absolute left-0 top-1/2 size-4 -translate-y-1/2 rounded-full bg-primary"
                style={{ transform: `translate(${go ? 'calc(100cqw - 1rem)' : '0'}, -50%)`, transition: go ? `transform 1000ms ${curve}` : 'none'}}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
