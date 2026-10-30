'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import {
  ActionMenu, Badge, Breadcrumb, Button, Checkbox, Combobox, Field, Input, NativeSelect, Pagination,
  SectionHeader, SegmentedControl, Stepper, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui'

const ORDERS = [
  { id: '#1042', cliente: 'Lucía Pérez', estado: 'Pagado', total: '$ 18.400' },
  { id: '#1041', cliente: 'Marcos Díaz', estado: 'Pendiente', total: '$ 6.250' },
  { id: '#1040', cliente: 'Ana Ruiz', estado: 'Cancelado', total: '$ 9.900' },
] as const

const TONE = { Pagado: 'success', Pendiente: 'warning', Cancelado: 'destructive' } as const
const COUNTRIES = ['Argentina', 'Brasil', 'Chile', 'Colombia', 'México', 'Perú', 'Uruguay', 'Paraguay'].map((c) => ({ value: c.toLowerCase(), label: c }))

export function ComponentsDemo() {
  const [view, setView] = useState<'lista' | 'grilla'>('lista')
  const [page, setPage] = useState(1)
  const [country, setCountry] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const error = name.length > 0 && name.length < 3 ? 'Mínimo 3 caracteres' : undefined

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader title="Botones y etiquetas" />
        <div className="flex flex-wrap gap-2">
          <Button>Principal</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="destructive"><Trash2 /> Eliminar</Button>
          <Button size="icon" aria-label="Agregar"><Plus /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Nuevo</Badge><Badge variant="secondary">Borrador</Badge><Badge variant="success" dot>Activo</Badge>
          <Badge variant="warning" dot>Revisar</Badge><Badge variant="destructive" dot>Error</Badge><Badge variant="outline">Etiqueta</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Formulario" description="Field enlaza etiqueta, ayuda y error con aria-describedby." />
        <div className="grid gap-4 medium:grid-cols-2">
          <Field id="nombre" label="Nombre" hint="Como figura en tu documento." error={error}>
            {(a11y) => <Input id="nombre" value={name} onChange={(e) => setName(e.target.value)} {...a11y} />}
          </Field>
          <Field id="rol" label="Rol (lista corta)">
            {() => (
              <NativeSelect id="rol" defaultValue="editor">
                <option value="owner">Propietario</option><option value="editor">Editor</option><option value="viewer">Lector</option>
              </NativeSelect>
            )}
          </Field>
          <Field id="pais" label="País (más de ~7 opciones)">
            {() => <Combobox id="pais" listLabel="Países" options={COUNTRIES} value={country} onValueChange={setCountry} placeholder="Elegí un país" />}
          </Field>
          <div className="space-y-3">
            <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox /> Acepto los términos</label>
            <label className="flex min-h-11 items-center gap-2 text-sm"><Switch /> Notificaciones por email</label>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Tabla" description="En compact (< 600 px) las filas se vuelven tarjetas gracias a stack + data-label." />
        <Table stack>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead className="w-12"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ORDERS.map((o) => (
              <TableRow key={o.id}>
                <TableCell data-label="Pedido" className="font-mono">{o.id}</TableCell>
                <TableCell data-label="Cliente">{o.cliente}</TableCell>
                <TableCell data-label="Estado"><Badge variant={TONE[o.estado]} dot>{o.estado}</Badge></TableCell>
                <TableCell data-label="Total" className="text-right tabular-nums">{o.total}</TableCell>
                <TableCell>
                  <ActionMenu
                    title={`Pedido ${o.id}`}
                    items={[
                      { label: 'Editar', icon: <Pencil />, onSelect: () => {} },
                      { label: 'Eliminar', icon: <Trash2 />, onSelect: () => {}, destructive: true, separatorBefore: true },
                    ]}
                  >
                    <Button variant="ghost" size="icon" aria-label={`Acciones del pedido ${o.id}`}>…</Button>
                  </ActionMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={page} pageCount={12} onPageChange={setPage} />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Navegación y pasos" />
        <Breadcrumb items={[{ label: 'Inicio', href: '/' }, { label: 'Tienda', href: '/componentes' }, { label: 'Pedido #1042' }]} />
        <SegmentedControl aria-label="Vista" value={view} onValueChange={setView} options={[{ value: 'lista', label: 'Lista' }, { value: 'grilla', label: 'Grilla' }]} />
        <Stepper steps={['Carrito', 'Envío', 'Pago', 'Listo']} current={step} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>Anterior</Button>
          <Button size="sm" onClick={() => setStep((s) => Math.min(3, s + 1))}>Siguiente</Button>
        </div>
      </section>
    </div>
  )
}
