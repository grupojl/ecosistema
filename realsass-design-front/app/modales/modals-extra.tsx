'use client'

import { useState } from 'react'
import { ArrowDownUp, Pencil, Printer, Search, Trash2 } from 'lucide-react'
import {
  ActionMenu, Button, CommandPalette, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  NativeSelect, SectionHeader, SegmentedControl, useSizeClass, Label, Switch,
  type ModalPresentationName, type ModalSize, type SizeClass,
} from '@/components/ui'

const PRES: ReadonlyArray<{ value: ModalPresentationName; label: string }> = [
  { value: 'center', label: 'Centrado' }, { value: 'sheet', label: 'Hoja inferior' }, { value: 'side', label: 'Panel lateral' },
  { value: 'fullscreen', label: 'Pantalla completa' }, { value: 'top', label: 'Superior' },
]
const CLASSES: readonly SizeClass[] = ['compact', 'medium', 'expanded']

/** Probador: elige la presentación de cada clase de tamaño y ábrelo. */
export function Playground() {
  const size = useSizeClass()
  const [pres, setPres] = useState<Record<SizeClass, ModalPresentationName>>({ compact: 'sheet', medium: 'center', expanded: 'center' })
  const [width, setWidth] = useState<ModalSize>('md')
  const [tall, setTall] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-3 medium:grid-cols-3">
        {CLASSES.map((c) => (
          <div key={c} className="space-y-1">
            <Label htmlFor={`pg-${c}`} className="capitalize">{c}</Label>
            <NativeSelect id={`pg-${c}`} value={pres[c]} onChange={(e) => setPres((p) => ({ ...p, [c]: e.target.value as ModalPresentationName }))}>
              {PRES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </NativeSelect>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1">
          <span className="text-sm font-medium">Ancho del panel</span>
          <SegmentedControl aria-label="Ancho del panel" value={width} onValueChange={setWidth} options={[{ value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><Switch checked={tall} onCheckedChange={setTall} /> Hoja alta</label>
        <Button onClick={() => setOpen(true)}>Abrir modal</Button>
      </div>
      <p className="text-xs text-muted-foreground">Tu clase actual: <span className="font-medium text-foreground">{size}</span> → se muestra «{PRES.find((p) => p.value === pres[size])?.label}».</p>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{`<DialogContent
  presentation={{ compact: '${pres.compact}', medium: '${pres.medium}', expanded: '${pres.expanded}' }}
  size="${width}"${tall ? '\n  tall' : ''}
/>`}</pre>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent presentation={pres} size={width} tall={tall}>
          <DialogHeader>
            <DialogTitle>Modal de prueba</DialogTitle>
            <DialogDescription>Arrastra el agarre (en hoja), toca fuera, pulsa Esc o «atrás» del sistema para cerrar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-2 text-sm text-muted-foreground">
            <p>El contenido que no cabe se desplaza dentro del modal; la cabecera y las acciones se quedan fijas.</p>
            <p>Cambia el tamaño de la ventana con el modal abierto: la presentación se recalcula sola.</p>
            <p>Las hojas respetan el teclado virtual y la zona segura inferior; las pantallas completas, la zona segura superior.</p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <DialogClose asChild><Button>Entendido</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const COMMANDS = [
  { id: 'ped', label: 'Pedidos', group: 'Sección' }, { id: 'prod', label: 'Productos', group: 'Sección' }, { id: 'cli', label: 'Clientes', group: 'Sección' },
  { id: 'nuevo', label: 'Crear pedido', group: 'Acción', keywords: 'nuevo agregar' }, { id: 'imp', label: 'Imprimir etiqueta', group: 'Acción' },
] as const

/** Búsqueda (CommandPalette) y menú adaptable (ActionMenu). */
export function SearchAndMenu() {
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState('Reciente')
  return (
    <div className="grid gap-4 medium:grid-cols-2">
      <div className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium">Búsqueda</h3>
        <p className="text-sm text-muted-foreground">Pantalla completa en compact (cabe el teclado virtual) y superior en pantallas grandes. También con Ctrl/⌘ K.</p>
        <Button onClick={() => setOpen(true)}><Search /> Abrir búsqueda</Button>
        <CommandPalette
          open={open} onOpenChange={setOpen} label="Buscar en el panel" placeholder="Buscar pedidos, productos, acciones…"
          commands={COMMANDS.map((c) => ({ ...c, onSelect: () => { setOpen(false) } }))}
        />
      </div>
      <div className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium">Menú adaptable</h3>
        <p className="text-sm text-muted-foreground">Mismas acciones: hoja de acciones con filas grandes en compact, popover junto al botón en medium y expanded.</p>
        <div className="flex flex-wrap gap-2">
          <ActionMenu
            title="Pedido #1042"
            items={[
              { label: 'Editar', icon: <Pencil />, onSelect: () => {} },
              { label: 'Imprimir', icon: <Printer />, onSelect: () => {} },
              { label: 'Eliminar', icon: <Trash2 />, onSelect: () => {}, destructive: true, separatorBefore: true },
            ]}
          >
            <Button>Acciones</Button>
          </ActionMenu>
          <ActionMenu
            title="Ordenar por"
            items={['Reciente', 'Antiguo', 'Mayor total'].map((l) => ({ label: l, onSelect: () => setSort(l) }))}
          >
            <Button><ArrowDownUp /> Ordenar: {sort}</Button>
          </ActionMenu>
        </div>
      </div>
    </div>
  )
}

export function ModalsHeading() { return <SectionHeader title="Probador de presentaciones" description="Elige la presentación de cada clase y ábrelo. Abajo tienes los atributos listos para copiar." /> }
