'use client'

import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle, Button } from '@/components/ui'
import { auditTouch, isCoarse, sizeClassNow } from '@/lib/audits'

type Result = { n: number; bad: { name: string; w: number; h: number }[]; size: string; applies: boolean }

export function TouchAudit() {
  const [res, setRes] = useState<Result | null>(null)
  const run = () => {
    const size = sizeClassNow()
    setRes({ ...auditTouch(), size, applies: size !== 'expanded' || isCoarse() })
  }
  return (
    <div className="space-y-3">
      <Button onClick={run}><ScanLine /> Auditar esta pantalla</Button>
      <div aria-live="polite">
        {!res && <p className="text-sm text-muted-foreground">Aún no se ha ejecutado.</p>}
        {res && (
          <Alert variant={res.bad.length === 0 ? 'success' : res.applies ? 'destructive' : 'info'}>
            <AlertTitle>
              {res.bad.length === 0
                ? `Los ${res.n} controles miden al menos 44×44`
                : `${res.bad.length} de ${res.n} controles por debajo de 44 px (clase ${res.size})`}
            </AlertTitle>
            <AlertDescription>
              {!res.applies && res.bad.length > 0 && <p>Clase expanded con puntero fino: se informa, no es obligatorio.</p>}
              {res.bad.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {res.bad.map((b, i) => <li key={i}><span className="font-mono text-xs">{b.name}</span> · {b.w}×{b.h} px</li>)}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
