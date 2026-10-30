'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, OctagonAlert } from 'lucide-react'
import {
  Alert, AlertDescription, AlertTitle, Button, Checkbox, Combobox, DateInput, Field, FieldError, Input, NativeSelect, Switch, toast,
} from '@/components/ui'

const COUNTRIES = [
  ['ar', 'Argentina'], ['br', 'Brasil'], ['cl', 'Chile'], ['co', 'Colombia'], ['mx', 'México'], ['pe', 'Perú'], ['uy', 'Uruguay'], ['py', 'Paraguay'], ['bo', 'Bolivia'], ['ec', 'Ecuador'],
].map(([value, label]) => ({ value, label }))
const INTERESTS = ['Moda', 'Hogar', 'Tecnología', 'Deportes'] as const

interface Values { name: string; email: string; phone: string; password: string; confirm: string; birth: string; country: string | null; role: string; terms: boolean }
type Errors = Partial<Record<keyof Values, string>>

const INITIAL: Values = { name: '', email: '', phone: '', password: '', confirm: '', birth: '', country: null, role: '', terms: false }

/** Fuerza de la contraseña: 0 (vacía) a 4. */
const strength = (p: string) => (p ? [p.length >= 8, /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length : 0)
const STRENGTH = ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'] as const

function validate(v: Values): Errors {
  const e: Errors = {}
  if (v.name.trim().length < 3) e.name = 'Escribe tu nombre completo (mínimo 3 letras).'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.email = 'El correo no es válido. Revisa que tenga el formato nombre@dominio.com.'
  if (v.phone && !/^\+?[\d\s-]{8,15}$/.test(v.phone)) e.phone = 'Usa solo números, con 8 a 15 dígitos. Ejemplo: +54 11 5555 1234.'
  if (v.password.length < 8) e.password = 'La contraseña necesita al menos 8 caracteres.'
  else if (strength(v.password) < 3) e.password = 'Agrega una mayúscula y un número para hacerla más segura.'
  if (v.confirm !== v.password) e.confirm = 'Las contraseñas no coinciden. Vuelve a escribirla.'
  if (!v.birth) e.birth = 'Elige tu fecha de nacimiento.'
  else if (new Date(v.birth) > new Date(Date.now() - 18 * 365.25 * 864e5)) e.birth = 'Debes ser mayor de 18 años para crear una cuenta.'
  if (!v.country) e.country = 'Elige tu país.'
  if (!v.role) e.role = 'Elige cómo vas a usar la cuenta.'
  if (!v.terms) e.terms = 'Acepta los términos para continuar.'
  return e
}

export function SignupForm() {
  const [v, setV] = useState<Values>(INITIAL)
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [show, setShow] = useState(false)
  const [sending, setSending] = useState(false)
  const [interests, setInterests] = useState<readonly string[]>([])
  const [news, setNews] = useState(true)
  const summaryRef = useRef<HTMLDivElement>(null)

  const errors = validate(v)
  const err = (k: keyof Values) => (touched[k] || submitted ? errors[k] : undefined)
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }))
  const blur = (k: keyof Values) => setTouched((t) => ({ ...t, [k]: true }))
  const list = Object.entries(errors) as [keyof Values, string][]
  const sc = strength(v.password)

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    setSubmitted(true)
    if (list.length) { requestAnimationFrame(() => summaryRef.current?.focus()); return }
    setSending(true)
    setTimeout(() => { setSending(false); toast.success('Cuenta creada', { description: `Te enviamos un correo a ${v.email}.` }); setV(INITIAL); setTouched({}); setSubmitted(false); setInterests([]) }, 1200)
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5 rounded-lg border p-4 medium:p-6" aria-describedby="signup-help">
      <p id="signup-help" className="text-sm text-muted-foreground">Los campos con <span aria-hidden="true">*</span><span className="sr-only">asterisco</span> son obligatorios.</p>

      {submitted && list.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <p className="flex items-center gap-2 font-medium text-destructive-ink"><OctagonAlert className="size-4" aria-hidden="true" /> Hay {list.length} {list.length === 1 ? 'campo' : 'campos'} por corregir</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-6 text-sm">
            {list.map(([k, m]) => <li key={k}><a className="underline underline-offset-2" href={`#f-${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(`f-${k}`)?.focus() }}>{m}</a></li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-5 medium:grid-cols-2">
        <Field id="f-name" label="Nombre completo *" error={err('name')}>
          {(a) => <Input id="f-name" autoComplete="name" value={v.name} onChange={(e) => set('name', e.target.value)} onBlur={() => blur('name')} {...a} />}
        </Field>
        <Field id="f-email" label="Correo electrónico *" hint="Te enviaremos el recibo y los avisos." error={err('email')}>
          {(a) => <Input id="f-email" type="email" inputMode="email" autoComplete="email" value={v.email} onChange={(e) => set('email', e.target.value)} onBlur={() => blur('email')} {...a} />}
        </Field>
        <Field id="f-phone" label="Teléfono" hint="Opcional. Con código de país." error={err('phone')}>
          {(a) => <Input id="f-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+54 11 5555 1234" value={v.phone} onChange={(e) => set('phone', e.target.value)} onBlur={() => blur('phone')} {...a} />}
        </Field>
        <Field id="f-birth" label="Fecha de nacimiento *" error={err('birth')}>
          {(a) => <DateInput id="f-birth" autoComplete="bday" value={v.birth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('birth', e.target.value)} onBlur={() => blur('birth')} {...a} />}
        </Field>

        <Field id="f-password" label="Contraseña *" hint="Mínimo 8 caracteres, con una mayúscula y un número." error={err('password')}>
          {(a) => (
            <div className="space-y-2">
              <div className="relative">
                <Input id="f-password" type={show ? 'text' : 'password'} autoComplete="new-password" className="pr-12" value={v.password} onChange={(e) => set('password', e.target.value)} onBlur={() => blur('password')} {...a} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2" aria-live="polite">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= sc ? (sc <= 1 ? 'bg-destructive' : sc === 2 ? 'bg-warning' : 'bg-success') : 'bg-muted'}`} />)}
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground">{STRENGTH[sc]}</span>
              </div>
            </div>
          )}
        </Field>
        <Field id="f-confirm" label="Repetir contraseña *" error={err('confirm')}>
          {(a) => <Input id="f-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={v.confirm} onChange={(e) => set('confirm', e.target.value)} onBlur={() => blur('confirm')} {...a} />}
        </Field>

        <Field id="f-country" label="País *" hint="Más de ~7 opciones: lista con búsqueda." error={err('country')}>
          {(a) => <Combobox id="f-country" listLabel="Países" options={COUNTRIES} value={v.country} onValueChange={(c) => { set('country', c); blur('country') }} placeholder="Elige un país" {...a} />}
        </Field>
        <Field id="f-role" label="¿Cómo vas a usar la cuenta? *" hint="Pocas opciones: lista nativa (mejor en celular)." error={err('role')}>
          {(a) => (
            <NativeSelect id="f-role" value={v.role} onChange={(e) => set('role', e.target.value)} onBlur={() => blur('role')} {...a}>
              <option value="">Elige una opción</option><option value="owner">Soy dueño de una tienda</option><option value="staff">Colaboro en una tienda</option><option value="other">Otro</option>
            </NativeSelect>
          )}
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Intereses</legend>
        <div className="flex flex-wrap gap-x-5">
          {INTERESTS.map((i) => (
            <label key={i} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={interests.includes(i)} onCheckedChange={(c) => setInterests((l) => (c ? [...l, i] : l.filter((x) => x !== i)))} /> {i}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm"><span>Recibir novedades por correo</span><Switch checked={news} onCheckedChange={setNews} /></label>
        <div className="space-y-1">
          <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm">
            <Checkbox id="f-terms" className="mt-0.5" checked={v.terms} onCheckedChange={(c) => { set('terms', c === true); blur('terms') }} aria-invalid={err('terms') ? true : undefined} aria-describedby={err('terms') ? 'f-terms-err' : undefined} />
            <span>Acepto los términos y la política de privacidad *</span>
          </label>
          {err('terms') && <FieldError id="f-terms-err">{err('terms')}</FieldError>}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => { setV(INITIAL); setTouched({}); setSubmitted(false); setInterests([]) }}>Limpiar</Button>
        <Button type="submit" disabled={sending}>{sending ? 'Creando cuenta…' : 'Crear cuenta'}</Button>
      </div>
      <Alert variant="info"><AlertTitle>Demostración</AlertTitle><AlertDescription>No se envía nada: el formulario solo muestra cómo se valida y se informa cada error.</AlertDescription></Alert>
    </form>
  )
}
