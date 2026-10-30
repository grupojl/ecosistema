'use client'

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { FileUp, Search, Trash2, Upload } from 'lucide-react'
import {
  Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Label, NativeSelect, QuantityStepper, RadioGroup, RadioGroupItem,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider, Switch, Textarea, ToggleGroup, ToggleGroupItem, toast,
} from '@/components/ui'

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

/** Input con prefijo y/o sufijo (moneda, unidades). */
function Affix({ id, prefix, suffix, ...props }: { id: string; prefix?: string; suffix?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex items-stretch">
      {prefix && <span className="grid min-w-10 place-items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">{prefix}</span>}
      <Input id={id} className={`${prefix ? 'rounded-l-none' : ''} ${suffix ? 'rounded-r-none' : ''}`} {...props} />
      {suffix && <span className="grid min-w-10 place-items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  )
}

function Otp() {
  const [d, setD] = useState<string[]>(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const put = (i: number, ch: string) => { setD((p) => p.map((x, k) => (k === i ? ch : x))); if (ch && i < 5) refs.current[i + 1]?.focus() }
  const key = (i: number, e: KeyboardEvent) => { if (e.key === 'Backspace' && !d[i] && i > 0) refs.current[i - 1]?.focus() }
  const paste = (e: ClipboardEvent) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!t) return
    e.preventDefault(); setD(Array.from({ length: 6 }, (_, i) => t[i] ?? '')); refs.current[Math.min(t.length, 5)]?.focus()
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Código de verificación</legend>
      <div className="flex gap-2" onPaste={paste}>
        {d.map((x, i) => (
          <input
            key={i} ref={(el) => { refs.current[i] = el }} value={x} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={1}
            aria-label={`Dígito ${i + 1} de 6`} onChange={(e) => put(i, e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => key(i, e)}
            className="size-11 rounded-md border border-input bg-background text-center text-lg font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Pega el código completo o escribe un dígito por casilla.</p>
    </fieldset>
  )
}

function Dropzone() {
  const [files, setFiles] = useState<File[]>([])
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const add = (list: FileList | null) => {
    if (!list) return
    const ok = Array.from(list).filter((f) => f.size <= 5 * 1024 * 1024)
    if (ok.length < list.length) toast.warning('Algunos archivos pesan más de 5 MB', { description: 'Se omitieron: reduce su tamaño e inténtalo de nuevo.' })
    setFiles((p) => [...p, ...ok])
  }
  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
        className={`grid place-items-center gap-1 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${over ? 'border-primary bg-accent' : 'border-input'}`}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        <p>Arrastra imágenes aquí o</p>
        <Button size="sm" type="button" variant="outline" onClick={() => input.current?.click()}><FileUp /> Elegir archivos</Button>
        <p className="text-xs text-muted-foreground">PNG o JPG, hasta 5 MB cada una.</p>
        <input ref={input} type="file" accept="image/png,image/jpeg" multiple className="sr-only" aria-label="Elegir imágenes" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>
      {files.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1">
              <span className="min-w-0 truncate">{f.name} <span className="text-muted-foreground">· {(f.size / 1024).toFixed(0)} KB</span></span>
              <Button type="button" size="icon" variant="ghost" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((p) => p.filter((_, k) => k !== i))}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ControlsGallery() {
  const [bio, setBio] = useState('')
  const [price, setPrice] = useState<number[]>([2000, 8000])
  const [qty, setQty] = useState(2)
  const [align, setAlign] = useState('left')
  const [plan, setPlan] = useState('pro')
  const MAX = 160

  return (
    <div className="grid gap-4 expanded:grid-cols-2">
      <Block title="Estados del campo">
        <Field id="g-normal" label="Normal" hint="Ayuda debajo del campo.">{() => <Input id="g-normal" placeholder="Escribe aquí" />}</Field>
        <Field id="g-off" label="Deshabilitado">{() => <Input id="g-off" disabled value="No editable" readOnly />}</Field>
        <Field id="g-ro" label="Solo lectura" hint="Se puede seleccionar y copiar.">{() => <Input id="g-ro" readOnly value="ord_9f3a1c7e" className="font-mono" />}</Field>
        <Field id="g-bad" label="Inválido" error="Este SKU ya existe. Prueba con SKU-0043.">{(a) => <Input id="g-bad" defaultValue="SKU-0042" {...a} />}</Field>
        <Field id="g-search" label="Búsqueda">{() => <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="g-search" type="search" className="pl-9" placeholder="Pedidos, productos…" /></div>}</Field>
      </Block>

      <Block title="Prefijo, sufijo y números">
        <Field id="g-price" label="Precio" hint="Sin puntos ni comas.">{() => <Affix id="g-price" prefix="$" suffix="ARS" inputMode="decimal" defaultValue="24900" />}</Field>
        <Field id="g-weight" label="Peso">{() => <Affix id="g-weight" suffix="kg" type="number" min={0} step={0.1} defaultValue="1.5" />}</Field>
        <Field id="g-web" label="Sitio web">{() => <Affix id="g-web" prefix="https://" placeholder="mitienda.com" />}</Field>
        <div className="space-y-1"><Label htmlFor="g-qty-wrap">Cantidad</Label><div id="g-qty-wrap"><QuantityStepper label="Cantidad" value={qty} onValueChange={setQty} min={1} max={10} /></div></div>
      </Block>

      <Block title="Texto largo con contador">
        <Field id="g-bio" label="Descripción" hint={`${bio.length} de ${MAX} caracteres`} error={bio.length > MAX ? `Te pasaste por ${bio.length - MAX} caracteres. Acorta el texto.` : undefined}>
          {(a) => <Textarea id="g-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} {...a} />}
        </Field>
      </Block>

      <Block title="Selección">
        <Field id="g-sel" label="Select (Radix)" hint="Para listas con grupos o contenido rico.">
          {() => (
            <Select defaultValue="es">
              <SelectTrigger id="g-sel"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="es">Español</SelectItem><SelectItem value="pt">Português</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
            </Select>
          )}
        </Field>
        <Field id="g-nat" label="Select nativo" hint="Para listas cortas: en celular abre el selector del sistema.">
          {() => <NativeSelect id="g-nat" defaultValue="b"><option value="a">Más reciente</option><option value="b">Mayor total</option><option value="c">Cliente (A–Z)</option></NativeSelect>}
        </Field>
        <RadioGroup value={plan} onValueChange={setPlan} aria-label="Plan" className="grid gap-2">
          {([['free', 'Gratis', 'Hasta 20 productos'], ['pro', 'Pro', 'Productos ilimitados · $29/mes'], ['team', 'Equipo', 'Colaboradores y roles · $79/mes']] as const).map(([id, t, d]) => (
            <label key={id} htmlFor={`g-plan-${id}`} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${plan === id ? 'border-primary bg-accent' : ''}`}>
              <RadioGroupItem id={`g-plan-${id}`} value={id} />
              <span><span className="block font-medium">{t}</span><span className="text-muted-foreground">{d}</span></span>
            </label>
          ))}
        </RadioGroup>
      </Block>

      <Block title="Rango y alternancia">
        <div className="space-y-3">
          <p className="flex justify-between text-sm"><Label>Rango de precio</Label><span className="tabular-nums">$ {price[0].toLocaleString('es-AR')} – $ {price[1].toLocaleString('es-AR')}</span></p>
          <Slider value={price} onValueChange={setPrice} min={0} max={10000} step={100} aria-label="Rango de precio" />
        </div>
        <div className="space-y-1">
          <Label id="g-align">Alineación (una opción)</Label>
          <ToggleGroup type="single" value={align} onValueChange={(v) => v && setAlign(v)} variant="outline" aria-labelledby="g-align" className="justify-start">
            <ToggleGroupItem value="left">Izquierda</ToggleGroupItem><ToggleGroupItem value="center">Centro</ToggleGroupItem><ToggleGroupItem value="right">Derecha</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>Publicar al guardar</span><Switch defaultChecked /></label>
      </Block>

      <Block title="Código de un solo uso"><Otp /></Block>
      <Block title="Archivos"><Dropzone /></Block>
    </div>
  )
}
