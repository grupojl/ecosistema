'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, OctagonAlert } from 'lucide-react'
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui'
import { contrastTable, type PairResult } from '@/lib/audits'

/** Recalcula los pares de tokens cada vez que cambia el tema (clase `dark` en <html>). */
export function ContrastLive() {
  const [rows, setRows] = useState<PairResult[]>([])
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const calc = () => { setRows(contrastTable()); setDark(document.documentElement.classList.contains('dark')) }
    calc()
    const mo = new MutationObserver(calc)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  const ok = rows.filter((r) => r.ok).length
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm" aria-live="polite">
        <Badge dot variant={ok === rows.length ? 'success' : 'destructive'}>{ok} de {rows.length} pares cumplen</Badge>
        <span className="text-muted-foreground">Tema {dark ? 'oscuro' : 'claro'}</span>
      </div>
      <Table stack>
        <TableCaption className="sr-only">Ratio de contraste de cada par de tokens en el tema actual</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Par</TableHead><TableHead scope="col">Muestra</TableHead>
            <TableHead scope="col" className="text-right">Ratio</TableHead><TableHead scope="col">Mínimo</TableHead><TableHead scope="col">Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell data-label="Par" className="font-medium">{r.name}</TableCell>
              <TableCell data-label="Muestra">
                <span
                  className="inline-block rounded-md border px-2 py-0.5 text-sm font-semibold"
                  style={{ color: `rgb(${r.fgRgb.join(',')})`, background: `rgb(${r.bgRgb.join(',')})` }}
                >
                  Aa
                </span>
              </TableCell>
              <TableCell data-label="Ratio" className="text-right tabular-nums">{r.ratio.toFixed(2).replace('.', ',')}:1</TableCell>
              <TableCell data-label="Mínimo" className="tabular-nums">{String(r.min).replace('.', ',')}:1</TableCell>
              <TableCell data-label="Resultado">
                {r.ok
                  ? <span className="inline-flex items-center gap-1 text-success-ink"><CircleCheck className="size-4" aria-hidden="true" /> Cumple{r.ratio >= 7 ? ' · AAA' : ''}</span>
                  : <span className="inline-flex items-center gap-1 text-destructive-ink"><OctagonAlert className="size-4" aria-hidden="true" /> Falla</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
