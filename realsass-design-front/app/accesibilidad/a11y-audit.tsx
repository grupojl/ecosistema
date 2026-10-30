'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle, Button } from '@/components/ui'
import { a11yAudit, type Finding } from '@/lib/audits'

export function A11yAudit() {
  const [res, setRes] = useState<{ out: Finding[]; checked: number } | null>(null)
  const errors = res?.out.filter((o) => o.sev === 'error').length ?? 0
  const warns = res?.out.filter((o) => o.sev === 'warn').length ?? 0
  return (
    <div className="space-y-3">
      <Button onClick={() => setRes(a11yAudit())}><ShieldCheck /> Auditar accesibilidad</Button>
      <div aria-live="polite">
        {!res && <p className="text-sm text-muted-foreground">Aún no se ha ejecutado.</p>}
        {res && (
          <Alert variant={errors ? 'destructive' : warns ? 'warning' : 'success'}>
            <AlertTitle>{errors} errores · {warns} avisos · {res.checked} textos revisados</AlertTitle>
            <AlertDescription>
              {res.out.length === 0 ? <p>Sin hallazgos.</p> : (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {res.out.map((f, i) => (
                    <li key={i}>
                      <span className="font-medium">{f.sev === 'error' ? 'Error' : 'Aviso'}:</span> {f.msg}
                      {f.where && <span className="font-mono text-xs"> — {f.where}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
