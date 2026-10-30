'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Trash2 } from 'lucide-react'
import {
  Badge, Button, Checkbox, EmptyState, LoadingState, NativeSelect, SegmentedControl, Table, TableBody, TableCaption, TableCell,
  TableHead, TableHeader, TableRow, Label,
  toast,
} from '@/components/ui'

interface Order { id: string; cliente: string; estado: 'Pagado' | 'Pendiente' | 'Cancelado'; total: number }
const ORDERS: readonly Order[] = [
  { id: '#1042', cliente: 'Lucía Pérez', estado: 'Pagado', total: 18400 }, { id: '#1041', cliente: 'Marcos Díaz', estado: 'Pendiente', total: 6250 },
  { id: '#1040', cliente: 'Ana Ruiz', estado: 'Cancelado', total: 9900 }, { id: '#1039', cliente: 'Bruno Sosa', estado: 'Pagado', total: 31200 },
  { id: '#1038', cliente: 'Carla Gil', estado: 'Pendiente', total: 4500 }, { id: '#1037', cliente: 'Diego Lara', estado: 'Pagado', total: 12750 },
]
const TONE = { Pagado: 'success', Pendiente: 'warning', Cancelado: 'destructive' } as const
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

type SortKey = 'id' | 'cliente' | 'total'
type DataState = 'datos' | 'cargando' | 'vacio' | 'error' | 'permisos'

export function TableDemo() {
  const [state, setState] = useState<DataState>('datos')
  const [density, setDensity] = useState<'comoda' | 'compacta'>('comoda')
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'ascending' | 'descending' }>({ key: 'id', dir: 'descending' })
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())

  const rows = useMemo(() => {
    const list = ORDERS.filter((o) => !removed.has(o.id) && (!filter || o.estado === filter))
    const m = sort.dir === 'ascending' ? 1 : -1
    return [...list].sort((a, b) => (a[sort.key] > b[sort.key] ? m : -m))
  }, [filter, sort, removed])

  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'ascending' ? 'descending' : 'ascending' }))
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const th = (key: SortKey, label: string, right = false) => (
    <TableHead scope="col" aria-sort={sort.key === key ? sort.dir : 'none'} className={right ? 'text-right' : undefined}>
      <button type="button" onClick={() => toggleSort(key)} className="inline-flex min-h-11 items-center gap-1 font-medium hover:text-foreground">
        {label}
        {sort.key === key ? (sort.dir === 'ascending' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-60" />}
      </button>
    </TableHead>
  )

  const bulkDelete = () => {
    const ids = [...selected]
    setRemoved((r) => new Set([...r, ...ids]))
    setSelected(new Set())
    toast(`${ids.length} pedidos eliminados`, { action: { label: 'Deshacer', onClick: () => setRemoved((r) => new Set([...r].filter((x) => !ids.includes(x)))) }, duration: 9000 })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="t-estado">Estado del pedido</Label>
          <NativeSelect id="t-estado" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todos los estados</option><option>Pagado</option><option>Pendiente</option><option>Cancelado</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium" id="t-datos">Datos</span>
          <SegmentedControl
            aria-label="Estado de los datos" value={state} onValueChange={setState}
            options={[{ value: 'datos', label: 'Datos' }, { value: 'cargando', label: 'Cargando' }, { value: 'vacio', label: 'Vacío' }, { value: 'error', label: 'Error' }, { value: 'permisos', label: 'Sin permisos' }]}
          />
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium">Densidad</span>
          <SegmentedControl aria-label="Densidad" value={density} onValueChange={setDensity} options={[{ value: 'comoda', label: 'Cómoda' }, { value: 'compacta', label: 'Compacta' }]} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent p-2 text-sm" role="status">
          <span className="font-medium">{selected.size} seleccionados</span>
          <Button size="sm" variant="outline" onClick={() => toast.success('Exportado')}><Download /> Exportar</Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 /> Eliminar</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpiar selección</Button>
        </div>
      )}

      {state === 'cargando' && <LoadingState rows={3} />}
      {state === 'error' && <EmptyState kind="error" onRetry={() => setState('datos')} />}
      {state === 'permisos' && <EmptyState kind="forbidden" />}
      {(state === 'vacio' || (state === 'datos' && rows.length === 0)) && (
        <EmptyState
          title={filter ? 'Sin resultados con estos filtros' : 'Aún no tienes pedidos'}
          description={filter ? 'Prueba con otro estado.' : 'Cuando recibas el primero aparecerá aquí.'}
          action={filter ? <Button size="sm" variant="outline" className="mt-1" onClick={() => setFilter('')}>Limpiar filtros</Button> : undefined}
        />
      )}
      {state === 'datos' && rows.length > 0 && (
        <Table stack className={density === 'compacta' ? '[&_td]:py-1.5' : undefined}>
          <TableCaption className="sr-only">Pedidos recientes</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Seleccionar todos (esta página)" checked={allOn}
                  onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())}
                />
              </TableHead>
              {th('id', 'Pedido')}{th('cliente', 'Cliente')}
              <TableHead scope="col">Estado</TableHead>
              {th('total', 'Total', true)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((o) => (
              <TableRow key={o.id} data-state={selected.has(o.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Seleccionar ${o.id}`} checked={selected.has(o.id)}
                    onCheckedChange={(c) => setSelected((s) => { const n = new Set(s); if (c) n.add(o.id); else n.delete(o.id); return n })}
                  />
                </TableCell>
                <TableCell data-label="Pedido" className="font-mono">{o.id}</TableCell>
                <TableCell data-label="Cliente">{o.cliente}</TableCell>
                <TableCell data-label="Estado"><Badge variant={TONE[o.estado]} dot>{o.estado}</Badge></TableCell>
                <TableCell data-label="Total" className="text-right tabular-nums">{money.format(o.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
