'use client'

import { useState, type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Avatar, AvatarFallback, Badge, Button, Checkbox, Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, Field, Input, MODAL_PRESETS, NativeSelect, SectionHeader, Switch, Textarea, toast,
  useSizeClass, type ModalPreset,
} from '@/components/ui'

function Card({ title, preset, text, children }: { title: string; preset: ModalPreset; text: string; children: ReactNode }) {
  const p = MODAL_PRESETS[preset].presentation
  return (
    <li className="flex flex-col justify-between gap-3 rounded-lg border p-4">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{title} <code className="font-mono text-xs text-muted-foreground">{preset}</code></p>
        <p className="text-sm text-muted-foreground">{text}</p>
        <p className="text-xs text-muted-foreground">C {p.compact} · M {p.medium} · E {p.expanded}</p>
      </div>
      <div>{children}</div>
    </li>
  )
}

/** Alerta de confirmación: foco en la opción segura y sin cierre al tocar fuera. */
function ConfirmAlert() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="sm" variant="destructive">Abrir alerta</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
          <AlertDialogDescription>El producto SKU-00421 se quitará del catálogo. Podrás deshacerlo unos segundos después.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => toast('Producto eliminado', { action: { label: 'Deshacer', onClick: () => toast.success('Producto restaurado') } })}>Eliminar producto</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Formulario con guardia: si hay cambios sin guardar, cerrar pide confirmar antes de descartarlos. */
function GuardedForm() {
  const [open, setOpen] = useState(false)
  const [ask, setAsk] = useState(false)
  const [name, setName] = useState('Camiseta Essential')
  const [price, setPrice] = useState('24.90')
  const dirty = name !== 'Camiseta Essential' || price !== '24.90'
  const close = () => { setAsk(false); setOpen(false); setName('Camiseta Essential'); setPrice('24.90') }
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Editar producto</Button>
      <Dialog open={open} onOpenChange={(o) => { if (o) setOpen(true); else if (dirty) setAsk(true); else close() }}>
        <DialogContent preset="form">
          <DialogHeader><DialogTitle>Editar producto</DialogTitle><DialogDescription>Cambia algo y prueba a cerrar: pedirá confirmar antes de descartar.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <Field id="gf-name" label="Nombre">{(a) => <Input id="gf-name" value={name} onChange={(e) => setName(e.target.value)} {...a} />}</Field>
            <Field id="gf-price" label="Precio">{(a) => <Input id="gf-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} {...a} />}</Field>
            <Field id="gf-cat" label="Categoría">{() => <NativeSelect id="gf-cat" defaultValue="ropa"><option value="ropa">Ropa</option><option value="calzado">Calzado</option><option value="acc">Accesorios</option></NativeSelect>}</Field>
            <Field id="gf-desc" label="Descripción">{() => <Textarea id="gf-desc" rows={3} defaultValue="Algodón orgánico, corte regular." />}</Field>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>Visible en la tienda</span><Switch defaultChecked /></label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => (dirty ? setAsk(true) : close())}>Cancelar</Button>
            <Button onClick={() => { toast.success('Producto guardado'); setOpen(false) }}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle><AlertDialogDescription>Tienes cambios sin guardar. Si sales ahora, se perderán.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={close}>Descartar cambios</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const PRODUCTS = ['Camiseta Essential', 'Gorra Classic', 'Zapatilla Urban', 'Mochila Daily', 'Botella Térmica', 'Campera Liviana', 'Pantalón Chino', 'Medias Pack x3']

function PickProducts() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set())
  const list = PRODUCTS.filter((p) => p.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Elegir productos</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent preset="selection">
          <DialogHeader><DialogTitle>Agregar productos</DialogTitle><DialogDescription>Elige los que quieras sumar al pedido.</DialogDescription></DialogHeader>
          <div className="space-y-2 px-6 pb-2">
            <Input aria-label="Buscar producto" type="search" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="divide-y rounded-lg border">
              {list.map((p) => (
                <li key={p}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 text-sm">
                    <Checkbox checked={sel.has(p)} onCheckedChange={(c) => setSel((s) => { const n = new Set(s); if (c) n.add(p); else n.delete(p); return n })} /> {p}
                  </label>
                </li>
              ))}
              {list.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin resultados para «{q}».</li>}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={sel.size === 0} onClick={() => { toast.success(`${sel.size} productos agregados`); setOpen(false); setSel(new Set()) }}>Agregar{sel.size ? ` (${sel.size})` : ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function OrderDetail() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Ver pedido #1042</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent preset="detail">
          <DialogHeader><DialogTitle className="flex items-center gap-2">Pedido #1042 <Badge variant="success" dot>Pagado</Badge></DialogTitle><DialogDescription>Ñuñoa · envío en 48 h</DialogDescription></DialogHeader>
          <div className="space-y-5 px-6 pb-2 text-sm">
            <div className="flex items-center gap-3"><Avatar><AvatarFallback>AL</AvatarFallback></Avatar><div><p className="font-medium">Ana López</p><p className="text-muted-foreground">ana@tienda.com</p></div></div>
            <section aria-labelledby="od-items">
              <h3 id="od-items" className="mb-1 font-medium">Productos</h3>
              <dl className="divide-y rounded-lg border">
                {([['Camiseta Essential × 2', '$ 49,80'], ['Gorra Classic × 1', '$ 22,10'], ['Envío', '$ 8,00']] as const).map(([a, b]) => <div key={a} className="flex justify-between px-3 py-2"><dt>{a}</dt><dd className="tabular-nums">{b}</dd></div>)}
                <div className="flex justify-between px-3 py-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">$ 79,90</dd></div>
              </dl>
            </section>
            <section aria-labelledby="od-track">
              <h3 id="od-track" className="mb-1 font-medium">Seguimiento</h3>
              <ol className="space-y-1 text-muted-foreground"><li>✓ Pago confirmado · hoy, 10:42</li><li>● Preparando el paquete · en curso</li><li>○ Entrega estimada: jueves</li></ol>
            </section>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => toast.info('Imprimiendo…')}><Printer /> Imprimir</Button><Button onClick={() => { toast.success('Pedido marcado como enviado'); setOpen(false) }}>Marcar como enviado</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Filters() {
  const [open, setOpen] = useState(false)
  const [channels, setChannels] = useState<readonly string[]>(['Tienda online'])
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Abrir filtros</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent preset="filters">
          <DialogHeader><DialogTitle>Filtros</DialogTitle><DialogDescription>Misma lista de campos: hoja en compact, panel lateral cuando hay espacio.</DialogDescription></DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <Field id="fl-state" label="Estado del pedido">{() => <NativeSelect id="fl-state"><option>Todos</option><option>Pagado</option><option>Pendiente</option><option>Cancelado</option></NativeSelect>}</Field>
            <fieldset className="space-y-1"><legend className="text-sm font-medium">Canal</legend>
              {['Tienda online', 'Marketplace', 'Punto de venta'].map((c) => (
                <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><Checkbox checked={channels.includes(c)} onCheckedChange={(on) => setChannels((l) => (on ? [...l, c] : l.filter((x) => x !== c)))} /> {c}</label>
              ))}
            </fieldset>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setChannels([])}>Limpiar</Button><Button onClick={() => { setOpen(false); toast.info('Filtros aplicados', { description: `${channels.length} canales` }) }}>Aplicar filtros</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NewProduct() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Nuevo producto</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent preset="longForm">
          <DialogHeader><DialogTitle>Nuevo producto</DialogTitle><DialogDescription>Barra superior con cerrar y acciones fijas abajo; en pantallas grandes pasa a modal centrado.</DialogDescription></DialogHeader>
          <div className="grid gap-4 px-6 pb-2 medium:grid-cols-2">
            <Field id="np-name" label="Nombre">{(a) => <Input id="np-name" {...a} />}</Field>
            <Field id="np-sku" label="SKU">{(a) => <Input id="np-sku" className="font-mono" {...a} />}</Field>
            <Field id="np-price" label="Precio">{(a) => <Input id="np-price" inputMode="decimal" {...a} />}</Field>
            <Field id="np-stock" label="Stock">{(a) => <Input id="np-stock" type="number" min={0} {...a} />}</Field>
            <Field id="np-cat" label="Categoría">{() => <NativeSelect id="np-cat"><option>Ropa</option><option>Calzado</option><option>Accesorios</option></NativeSelect>}</Field>
            <Field id="np-seo" label="Título para buscadores" hint="Hasta 60 caracteres.">{(a) => <Input id="np-seo" maxLength={60} {...a} />}</Field>
            <Field id="np-desc" label="Descripción" className="medium:col-span-2">{() => <Textarea id="np-desc" rows={4} />}</Field>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm medium:col-span-2"><span>Publicar al guardar</span><Switch /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => { toast.success('Producto creado'); setOpen(false) }}>Crear producto</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ModalsDemo() {
  const size = useSizeClass()
  return (
    <section className="space-y-4">
      <SectionHeader title="Pruébalos" description={`Abre cada uno y cambia el tamaño de la ventana: la presentación cambia sola. Clase actual: ${size}.`} />
      <ul className="grid gap-3 medium:grid-cols-2 expanded:grid-cols-3">
        <Card title="Alerta de confirmación" preset="alert" text="Acción destructiva. El foco empieza en la opción segura y tocar fuera no la cierra."><ConfirmAlert /></Card>
        <Card title="Formulario con guardia" preset="form" text="Si cierras con cambios sin guardar, pide confirmar antes de descartarlos."><GuardedForm /></Card>
        <Card title="Hoja alta para elegir" preset="selection" text="Ocupa casi toda la pantalla para que el listado tenga espacio. Una sola altura."><PickProducts /></Card>
        <Card title="Detalle de un pedido" preset="detail" text="Pantalla completa con «atrás» en compact; panel derecho que deja ver la lista."><OrderDetail /></Card>
        <Card title="Filtros" preset="filters" text="Hoja inferior en compact, panel derecho cuando hay espacio."><Filters /></Card>
        <Card title="Formulario largo" preset="longForm" text="Pantalla completa en compact; centrado grande en pantallas anchas."><NewProduct /></Card>
      </ul>
    </section>
  )
}
