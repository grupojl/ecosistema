'use client'

import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle, Button, Field, Input, NativeSelect, RadioGroup, RadioGroupItem, Stepper, toast } from '@/components/ui'

const STEPS = ['Datos', 'Envío', 'Pago', 'Listo'] as const

interface D { name: string; email: string; street: string; city: string; zip: string; ship: string; card: string; exp: string; cvc: string }
const EMPTY: D = { name: '', email: '', street: '', city: '', zip: '', ship: 'standard', card: '', exp: '', cvc: '' }

const luhn = (n: string) => {
  const d = n.replace(/\s/g, '')
  if (!/^\d{13,19}$/.test(d)) return false
  let s = 0
  for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9 } s += x }
  return s % 10 === 0
}
const group = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()

function check(step: number, d: D): Partial<Record<keyof D, string>> {
  const e: Partial<Record<keyof D, string>> = {}
  if (step === 0) {
    if (d.name.trim().length < 3) e.name = 'Escribe tu nombre completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.email = 'El correo no es válido. Usa el formato nombre@dominio.com.'
  }
  if (step === 1) {
    if (!d.street.trim()) e.street = 'Escribe la calle y el número.'
    if (!d.city.trim()) e.city = 'Escribe la ciudad.'
    if (!/^\d{4,8}$/.test(d.zip)) e.zip = 'El código postal tiene entre 4 y 8 números.'
  }
  if (step === 2) {
    if (!luhn(d.card)) e.card = 'El número de tarjeta no es válido. Revisa que estén todos los dígitos (prueba 4242 4242 4242 4242).'
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(d.exp)) e.exp = 'Usa el formato MM/AA.'
    if (!/^\d{3,4}$/.test(d.cvc)) e.cvc = 'El código tiene 3 o 4 números.'
  }
  return e
}

export function CheckoutFlow() {
  const [step, setStep] = useState(0)
  const [d, setD] = useState<D>(EMPTY)
  const [tried, setTried] = useState(false)
  const errors = check(step, d)
  const e = (k: keyof D) => (tried ? errors[k] : undefined)
  const set = (k: keyof D, v: string) => setD((p) => ({ ...p, [k]: v }))

  const next = (ev: FormEvent) => {
    ev.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) return
    setTried(false)
    if (step === 2) toast.success('Pago aprobado', { description: 'Te enviamos el comprobante por correo.' })
    setStep((s) => s + 1)
  }

  return (
    <div className="space-y-4 rounded-lg border p-4 medium:p-6">
      <Stepper steps={STEPS} current={step} label="Pasos de la compra" />
      {step < 3 ? (
        <form noValidate onSubmit={next} className="space-y-4" aria-label={`Paso ${step + 1}: ${STEPS[step]}`}>
          {step === 0 && (
            <div className="grid gap-4 medium:grid-cols-2">
              <Field id="c-name" label="Nombre completo" error={e('name')}>{(a) => <Input id="c-name" autoComplete="name" value={d.name} onChange={(x) => set('name', x.target.value)} {...a} />}</Field>
              <Field id="c-email" label="Correo electrónico" error={e('email')}>{(a) => <Input id="c-email" type="email" autoComplete="email" value={d.email} onChange={(x) => set('email', x.target.value)} {...a} />}</Field>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-4 medium:grid-cols-2">
              <Field id="c-street" label="Calle y número" error={e('street')} className="medium:col-span-2">{(a) => <Input id="c-street" autoComplete="street-address" value={d.street} onChange={(x) => set('street', x.target.value)} {...a} />}</Field>
              <Field id="c-city" label="Ciudad" error={e('city')}>{(a) => <Input id="c-city" autoComplete="address-level2" value={d.city} onChange={(x) => set('city', x.target.value)} {...a} />}</Field>
              <Field id="c-zip" label="Código postal" error={e('zip')}>{(a) => <Input id="c-zip" inputMode="numeric" autoComplete="postal-code" value={d.zip} onChange={(x) => set('zip', x.target.value)} {...a} />}</Field>
              <RadioGroup value={d.ship} onValueChange={(v) => set('ship', v)} aria-label="Método de envío" className="grid gap-2 medium:col-span-2">
                {([['standard', 'Estándar', '3 a 5 días · Gratis'], ['express', 'Express', '24 a 48 horas · $ 3.500'], ['pickup', 'Retiro en sucursal', 'Hoy · Gratis']] as const).map(([id, t, s]) => (
                  <label key={id} htmlFor={`c-ship-${id}`} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${d.ship === id ? 'border-primary bg-accent' : ''}`}>
                    <RadioGroupItem id={`c-ship-${id}`} value={id} /><span><span className="block font-medium">{t}</span><span className="text-muted-foreground">{s}</span></span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-4 medium:grid-cols-3">
              <Field id="c-card" label="Número de tarjeta" error={e('card')} className="medium:col-span-3">{(a) => <Input id="c-card" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={d.card} onChange={(x) => set('card', group(x.target.value))} {...a} />}</Field>
              <Field id="c-exp" label="Vence (MM/AA)" error={e('exp')}>{(a) => <Input id="c-exp" inputMode="numeric" autoComplete="cc-exp" placeholder="08/29" maxLength={5} value={d.exp} onChange={(x) => set('exp', x.target.value.replace(/[^\d/]/g, '').replace(/^(\d{2})(\d)/, '$1/$2'))} {...a} />}</Field>
              <Field id="c-cvc" label="Código" error={e('cvc')}>{(a) => <Input id="c-cvc" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={d.cvc} onChange={(x) => set('cvc', x.target.value.replace(/\D/g, ''))} {...a} />}</Field>
              <Field id="c-ship" label="Envío elegido">{() => <NativeSelect id="c-ship" value={d.ship} onChange={(x) => set("ship", x.target.value)}><option value="standard">Estándar · Gratis</option><option value="express">Express · $ 3.500</option><option value="pickup">Retiro · Gratis</option></NativeSelect>}</Field>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={step === 0} onClick={() => { setTried(false); setStep((s) => s - 1) }}>Atrás</Button>
            <Button type="submit">{step === 2 ? 'Pagar' : 'Siguiente'}</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-success/15 text-success-ink"><Check className="size-6" aria-hidden="true" /></span>
          <h3 className="font-display text-xl font-semibold">¡Gracias, {d.name.split(' ')[0] || 'listo'}!</h3>
          <Alert variant="success" className="text-left"><AlertTitle>Pedido confirmado</AlertTitle><AlertDescription>Enviamos el recibo a {d.email || 'tu correo'}. Llega a {d.city || 'tu dirección'} en 3 a 5 días.</AlertDescription></Alert>
          <Button variant="outline" onClick={() => { setD(EMPTY); setStep(0) }}>Empezar de nuevo</Button>
        </div>
      )}
    </div>
  )
}
