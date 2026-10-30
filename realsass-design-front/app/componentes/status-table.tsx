import { Check, Clock, Minus } from 'lucide-react'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'
import { COMPONENT_STATUS, STATUS_COLUMNS } from '@/lib/data/system'

const CELL = {
  1: <Check className="size-4 text-success" aria-label="Cumple" />,
  0: <Clock className="size-4 text-warning" aria-label="Pendiente" />,
  n: <Minus className="size-4 text-muted-foreground" aria-label="No aplica" />,
} as const

export function StatusTable() {
  const all = COMPONENT_STATUS.flatMap((r) => r.slice(1))
  const ok = all.filter((v) => v === 1).length
  const applicable = all.filter((v) => v !== 'n').length
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" aria-live="polite">{ok} de {applicable} criterios aplicables cumplidos ({Math.round((ok / applicable) * 100)} %)</p>
      <Table>
        <TableCaption className="sr-only">Criterios de calidad por componente: teclado, lector de pantalla, 3 clases de tamaño, modo oscuro, movimiento, estados y pruebas</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Componente</TableHead>
            {STATUS_COLUMNS.map((c) => <TableHead key={c} scope="col" className="text-center">{c}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {COMPONENT_STATUS.map(([name, ...vals]) => (
            <TableRow key={name as string}>
              <TableHead scope="row" className="font-medium text-foreground">{name}</TableHead>
              {vals.map((v, i) => <TableCell key={i} className="text-center"><span className="inline-flex">{CELL[v as 0 | 1 | 'n']}</span></TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
