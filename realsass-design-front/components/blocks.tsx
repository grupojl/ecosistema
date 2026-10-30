import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui'

/** Lista de reglas con marca. */
export function RuleList({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

/** Tabla de referencia: en compact se vuelve lista de tarjetas (stack + data-label). */
export function RefTable({
  caption, head, rows,
}: { caption: string; head: readonly string[]; rows: ReadonlyArray<readonly ReactNode[]> }) {
  return (
    <Table stack>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>{head.map((h) => <TableHead key={h} scope="col">{h}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((c, j) => <TableCell key={j} data-label={head[j]} className={j === 0 ? 'font-medium' : undefined}>{c}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
