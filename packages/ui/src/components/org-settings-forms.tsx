"use client"

import * as React from "react"

import { Alert } from "./alert"
import { Button } from "./button"
import { Card } from "./card"
import { Field } from "./field"
import { Input } from "./input"
import { Label } from "./label"
import { NativeSelect } from "./native-select"
import { Switch } from "./switch"
import { Textarea } from "./textarea"

/**
 * Formularios de configuración de una organización (municipio) — los comparten el dashboard y sass-front.
 *
 *   <GeneralSettingsForm value={data.general} onSave={save} isSaving={m.isPending} errorMessage={m.error?.message} />
 *   <StorefrontSettingsForm value={data.storefront} onSave={save} … />
 *
 * Son presentacionales: reciben el valor y lo devuelven editado. Los tipos de abajo son estructurales; el contrato real
 * (Zod) vive en sass-back, y el front que los usa lo comprueba al pasar los datos de tRPC.
 * `readOnly` muestra todo deshabilitado (un colaborador puede ver, no modificar).
 */

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type LocaleCode = "es" | "pt" | "en" | "fr" | "de"

export interface DayHours { open: boolean; from: string; to: string }

export interface GeneralSettingsValue {
  timezone: string
  defaultLocale: LocaleCode
  contact: { publicEmail: string; emergencyPhone: string }
  hours: { mode: "always" | "schedule"; weekly: Record<WeekdayKey, DayHours>; note: string }
  assistant: {
    enabled: boolean
    name: string
    welcomeMessage: string
    outOfHoursMessage: string
    fallbackMessage: string
    disclaimer: string
    answerOnlyFromContent: boolean
    handoffEmail: string
  }
}

export interface StorefrontSettingsValue {
  brand: { publicName: string; tagline: string }
  seo: { title: string; description: string }
  social: { instagram: string; facebook: string; x: string; youtube: string; linkedin: string; tiktok: string }
  legal: { termsUrl: string; privacyUrl: string; returnsUrl: string }
  announcement: { enabled: boolean; text: string; linkUrl: string; linkLabel: string }
  display: { showEmail: boolean; showEmergencyPhone: boolean; showHours: boolean }
  webChat: { enabled: boolean; position: "right" | "left"; greeting: string; allowedOrigins: string[] }
}

interface FormShellProps<T> {
  value: T
  onSave: (next: T) => void | Promise<void>
  isSaving?: boolean
  errorMessage?: string | null
  readOnly?: boolean
}

const WEEKDAY_LABELS: ReadonlyArray<readonly [WeekdayKey, string]> = [
  ["mon", "Lunes"], ["tue", "Martes"], ["wed", "Miércoles"], ["thu", "Jueves"], ["fri", "Viernes"], ["sat", "Sábado"], ["sun", "Domingo"],
]

const TIMEZONES: ReadonlyArray<readonly [string, string]> = [
  ["America/Argentina/Buenos_Aires", "Argentina (Buenos Aires)"],
  ["America/Argentina/Cordoba", "Argentina (Córdoba)"],
  ["America/Argentina/Salta", "Argentina (Salta)"],
  ["America/Argentina/Mendoza", "Argentina (Mendoza)"],
  ["America/Santiago", "Chile"],
  ["America/Montevideo", "Uruguay"],
  ["America/Asuncion", "Paraguay"],
  ["America/La_Paz", "Bolivia"],
  ["America/Lima", "Perú"],
  ["America/Bogota", "Colombia"],
  ["America/Mexico_City", "México (Ciudad de México)"],
  ["America/Sao_Paulo", "Brasil (São Paulo)"],
  ["Europe/Madrid", "España (Madrid)"],
]

const LOCALE_LABELS: ReadonlyArray<readonly [LocaleCode, string]> = [
  ["es", "Español"], ["pt", "Português"], ["en", "English"], ["fr", "Français"], ["de", "Deutsch"],
]

// ── Piezas ───────────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  type?: string
  maxLength?: number
  placeholder?: string
  disabled?: boolean
}
function TextField({ id, label, value, onChange, hint, type = "text", maxLength, placeholder, disabled }: TextFieldProps) {
  return (
    <Field id={id} label={label} hint={hint}>
      {(a11y) => (
        <Input id={id} type={type} value={value} maxLength={maxLength} placeholder={placeholder} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} {...a11y} />
      )}
    </Field>
  )
}

function AreaField({ id, label, value, onChange, hint, maxLength, rows = 3, disabled }: Omit<TextFieldProps, "type" | "placeholder"> & { rows?: number }) {
  return (
    <Field id={id} label={label} hint={hint}>
      {(a11y) => (
        <Textarea id={id} value={value} rows={rows} maxLength={maxLength} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} {...a11y} />
      )}
    </Field>
  )
}

function SwitchField({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}

function FormActions({ dirty, isSaving, readOnly, errorMessage, onReset }: { dirty: boolean; isSaving?: boolean; readOnly?: boolean; errorMessage?: string | null; onReset: () => void }) {
  if (readOnly) return <p className="text-sm text-muted-foreground">Solo el dueño de la organización puede modificar esta configuración.</p>
  return (
    <div className="space-y-3">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!dirty || isSaving}>{isSaving ? "Guardando…" : "Guardar cambios"}</Button>
        <Button type="button" variant="ghost" disabled={!dirty || isSaving} onClick={onReset}>Descartar</Button>
      </div>
    </div>
  )
}

const parseOrigins = (text: string): string[] => text.split("\n").map((l) => l.trim()).filter((l) => l !== "")

/**
 * Un origen por línea. Conserva el texto crudo mientras se escribe (si se filtraran las líneas vacías en cada tecla, no
 * se podría escribir un salto de línea) y emite la lista limpia; si la lista cambia desde afuera (Descartar), se resincroniza.
 */
function OriginsField({ origins, onChange, disabled }: { origins: string[]; onChange: (next: string[]) => void; disabled?: boolean }) {
  const [text, setText] = React.useState(origins.join("\n"))
  const key = JSON.stringify(origins)
  React.useEffect(() => {
    if (JSON.stringify(parseOrigins(text)) !== key) setText(origins.join("\n"))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AreaField id="sf-chat-origins" label="Sitios autorizados"
      hint="Uno por línea, con https:// y sin ruta. Ejemplo: https://www.mimunicipio.gob.ar"
      rows={4} value={text} disabled={disabled}
      onChange={(v) => { setText(v); onChange(parseOrigins(v)) }} />
  )
}

/** Estado local del formulario: se reinicia cuando el valor guardado cambia (después de guardar o de recargar). */
function useDraft<T>(value: T) {
  const serialized = JSON.stringify(value)
  const [draft, setDraft] = React.useState<T>(value)
  React.useEffect(() => { setDraft(value) }, [serialized]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(draft) !== serialized
  return { draft, setDraft, dirty, reset: () => setDraft(value) }
}

// ── General ──────────────────────────────────────────────────────────────────

export function GeneralSettingsForm({ value, onSave, isSaving, errorMessage, readOnly }: FormShellProps<GeneralSettingsValue>) {
  const { draft, setDraft, dirty, reset } = useDraft(value)
  const lock = readOnly || isSaving
  const timezones = TIMEZONES.some(([tz]) => tz === draft.timezone) ? TIMEZONES : [...TIMEZONES, [draft.timezone, draft.timezone] as const]

  const setContact = (p: Partial<GeneralSettingsValue["contact"]>) => setDraft((d) => ({ ...d, contact: { ...d.contact, ...p } }))
  const setHours = (p: Partial<GeneralSettingsValue["hours"]>) => setDraft((d) => ({ ...d, hours: { ...d.hours, ...p } }))
  const setDay = (day: WeekdayKey, p: Partial<DayHours>) =>
    setDraft((d) => ({ ...d, hours: { ...d.hours, weekly: { ...d.hours.weekly, [day]: { ...d.hours.weekly[day], ...p } } } }))
  const setAssistant = (p: Partial<GeneralSettingsValue["assistant"]>) => setDraft((d) => ({ ...d, assistant: { ...d.assistant, ...p } }))

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (!lock) void onSave(draft) }} aria-label="Configuración general">
      <Section title="Región" description="Define cómo se interpretan los horarios y en qué idioma atiende por defecto.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="gs-timezone" label="Zona horaria">
            {(a11y) => (
              <NativeSelect id="gs-timezone" value={draft.timezone} disabled={lock} onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))} {...a11y}>
                {timezones.map(([tz, label]) => <option key={tz} value={tz}>{label}</option>)}
              </NativeSelect>
            )}
          </Field>
          <Field id="gs-locale" label="Idioma por defecto">
            {(a11y) => (
              <NativeSelect id="gs-locale" value={draft.defaultLocale} disabled={lock} onChange={(e) => {
                const next = LOCALE_LABELS.find(([code]) => code === e.target.value)
                if (next) setDraft((d) => ({ ...d, defaultLocale: next[0] }))
              }} {...a11y}>
                {LOCALE_LABELS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </NativeSelect>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Contacto" description="Datos de contacto institucional. Se publican solo si lo activás en la configuración del storefront.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="gs-email" label="Correo público" type="email" value={draft.contact.publicEmail} disabled={lock} maxLength={200}
            onChange={(v) => setContact({ publicEmail: v })} />
          <TextField id="gs-emergency" label="Teléfono de emergencia" type="tel" value={draft.contact.emergencyPhone} disabled={lock} maxLength={40}
            onChange={(v) => setContact({ emergencyPhone: v })} />
        </div>
      </Section>

      <Section title="Horario de atención" description="Las oficinas atienden según esta grilla; el asistente responde 24/7 y avisa cuando está fuera de horario.">
        <SwitchField id="gs-always" label="Atención sin horario (24/7)" checked={draft.hours.mode === "always"} disabled={lock}
          onChange={(on) => setHours({ mode: on ? "always" : "schedule" })} />
        {draft.hours.mode === "schedule" && (
          <ul className="space-y-2">
            {WEEKDAY_LABELS.map(([day, label]) => {
              const d = draft.hours.weekly[day]
              return (
                <li key={day} className="grid grid-cols-[7rem_auto] items-center gap-3 sm:grid-cols-[7rem_auto_1fr_1fr]">
                  <span className="text-sm font-medium">{label}</span>
                  <Switch aria-label={`${label}: abierto`} checked={d.open} disabled={lock} onCheckedChange={(open) => setDay(day, { open })} />
                  {d.open ? (
                    <>
                      <Input aria-label={`${label}: desde`} type="time" value={d.from} disabled={lock} onChange={(e) => setDay(day, { from: e.target.value })} />
                      <Input aria-label={`${label}: hasta`} type="time" value={d.to} disabled={lock} onChange={(e) => setDay(day, { to: e.target.value })} />
                    </>
                  ) : (
                    <span className="col-span-2 text-sm text-muted-foreground">Cerrado</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <AreaField id="gs-hours-note" label="Nota sobre el horario" hint="Feriados, guardias, horario de verano…" rows={2} maxLength={300}
          value={draft.hours.note} disabled={lock} onChange={(v) => setHours({ note: v })} />
      </Section>

      <Section title="Asistente de chat" description="Cómo atiende al ciudadano por WhatsApp y por el chat web.">
        <SwitchField id="gs-assistant-on" label="Asistente activado" checked={draft.assistant.enabled} disabled={lock} onChange={(enabled) => setAssistant({ enabled })} />
        <SwitchField id="gs-only-content" label="Responder solo con el contenido cargado"
          hint="Recomendado: si no hay información cargada, no inventa y deriva a una persona."
          checked={draft.assistant.answerOnlyFromContent} disabled={lock} onChange={(answerOnlyFromContent) => setAssistant({ answerOnlyFromContent })} />
        <TextField id="gs-assistant-name" label="Nombre del asistente" value={draft.assistant.name} maxLength={60} disabled={lock} onChange={(name) => setAssistant({ name })} />
        <AreaField id="gs-welcome" label="Mensaje de bienvenida" value={draft.assistant.welcomeMessage} maxLength={500} disabled={lock} onChange={(welcomeMessage) => setAssistant({ welcomeMessage })} />
        <AreaField id="gs-ooh" label="Mensaje fuera de horario" value={draft.assistant.outOfHoursMessage} maxLength={500} disabled={lock} onChange={(outOfHoursMessage) => setAssistant({ outOfHoursMessage })} />
        <AreaField id="gs-fallback" label="Cuando no sabe la respuesta" hint="Se envía al derivar a una persona del área." value={draft.assistant.fallbackMessage} maxLength={500} disabled={lock} onChange={(fallbackMessage) => setAssistant({ fallbackMessage })} />
        <AreaField id="gs-disclaimer" label="Aviso de asistente automático" rows={2} value={draft.assistant.disclaimer} maxLength={300} disabled={lock} onChange={(disclaimer) => setAssistant({ disclaimer })} />
        <TextField id="gs-handoff" label="Correo para derivaciones" type="email" hint="Recibe las consultas que el asistente no puede resolver." value={draft.assistant.handoffEmail} maxLength={200} disabled={lock} onChange={(handoffEmail) => setAssistant({ handoffEmail })} />
      </Section>

      <FormActions dirty={dirty} isSaving={isSaving} readOnly={readOnly} errorMessage={errorMessage} onReset={reset} />
    </form>
  )
}

// ── Storefront ───────────────────────────────────────────────────────────────

const SOCIAL_FIELDS: ReadonlyArray<readonly [keyof StorefrontSettingsValue["social"], string]> = [
  ["instagram", "Instagram"], ["facebook", "Facebook"], ["x", "X (Twitter)"], ["youtube", "YouTube"], ["linkedin", "LinkedIn"], ["tiktok", "TikTok"],
]

export function StorefrontSettingsForm({ value, onSave, isSaving, errorMessage, readOnly }: FormShellProps<StorefrontSettingsValue>) {
  const { draft, setDraft, dirty, reset } = useDraft(value)
  const lock = readOnly || isSaving

  const setBrand = (p: Partial<StorefrontSettingsValue["brand"]>) => setDraft((d) => ({ ...d, brand: { ...d.brand, ...p } }))
  const setSeo = (p: Partial<StorefrontSettingsValue["seo"]>) => setDraft((d) => ({ ...d, seo: { ...d.seo, ...p } }))
  const setSocial = (p: Partial<StorefrontSettingsValue["social"]>) => setDraft((d) => ({ ...d, social: { ...d.social, ...p } }))
  const setLegal = (p: Partial<StorefrontSettingsValue["legal"]>) => setDraft((d) => ({ ...d, legal: { ...d.legal, ...p } }))
  const setAnnouncement = (p: Partial<StorefrontSettingsValue["announcement"]>) => setDraft((d) => ({ ...d, announcement: { ...d.announcement, ...p } }))
  const setDisplay = (p: Partial<StorefrontSettingsValue["display"]>) => setDraft((d) => ({ ...d, display: { ...d.display, ...p } }))
  const setWebChat = (p: Partial<StorefrontSettingsValue["webChat"]>) => setDraft((d) => ({ ...d, webChat: { ...d.webChat, ...p } }))

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (!lock) void onSave(draft) }} aria-label="Configuración del storefront">
      <Section title="Marca pública" description="Cómo se presenta la organización en su sitio público.">
        <TextField id="sf-name" label="Nombre público" hint="Si lo dejás vacío se usa el nombre de la organización." value={draft.brand.publicName} maxLength={80} disabled={lock} onChange={(publicName) => setBrand({ publicName })} />
        <TextField id="sf-tagline" label="Lema" value={draft.brand.tagline} maxLength={120} disabled={lock} onChange={(tagline) => setBrand({ tagline })} />
      </Section>

      <Section title="Buscadores (SEO)" description="Título y descripción que aparecen en Google y al compartir el enlace.">
        <TextField id="sf-seo-title" label="Título" hint={`${draft.seo.title.length}/70`} value={draft.seo.title} maxLength={70} disabled={lock} onChange={(title) => setSeo({ title })} />
        <AreaField id="sf-seo-desc" label="Descripción" hint={`${draft.seo.description.length}/160`} rows={2} value={draft.seo.description} maxLength={160} disabled={lock} onChange={(description) => setSeo({ description })} />
      </Section>

      <Section title="Aviso destacado" description="Una franja visible en el sitio: cortes, feriados, campañas.">
        <SwitchField id="sf-ann-on" label="Mostrar aviso" checked={draft.announcement.enabled} disabled={lock} onChange={(enabled) => setAnnouncement({ enabled })} />
        <TextField id="sf-ann-text" label="Texto" value={draft.announcement.text} maxLength={200} disabled={lock} onChange={(text) => setAnnouncement({ text })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="sf-ann-url" label="Enlace (opcional)" type="url" placeholder="https://" value={draft.announcement.linkUrl} maxLength={300} disabled={lock} onChange={(linkUrl) => setAnnouncement({ linkUrl })} />
          <TextField id="sf-ann-label" label="Texto del enlace" value={draft.announcement.linkLabel} maxLength={40} disabled={lock} onChange={(linkLabel) => setAnnouncement({ linkLabel })} />
        </div>
      </Section>

      <Section title="Datos de contacto visibles" description="Qué contacto institucional se muestra en el sitio público.">
        <SwitchField id="sf-show-email" label="Correo público" checked={draft.display.showEmail} disabled={lock} onChange={(showEmail) => setDisplay({ showEmail })} />
        <SwitchField id="sf-show-phone" label="Teléfono de emergencia" checked={draft.display.showEmergencyPhone} disabled={lock} onChange={(showEmergencyPhone) => setDisplay({ showEmergencyPhone })} />
        <SwitchField id="sf-show-hours" label="Horario de atención" checked={draft.display.showHours} disabled={lock} onChange={(showHours) => setDisplay({ showHours })} />
      </Section>

      <Section title="Redes sociales">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_FIELDS.map(([key, label]) => (
            <TextField key={key} id={`sf-social-${key}`} label={label} type="url" placeholder="https://" value={draft.social[key]} maxLength={300} disabled={lock} onChange={(v) => setSocial({ [key]: v })} />
          ))}
        </div>
      </Section>

      <Section title="Enlaces legales" description="Términos, privacidad y devoluciones: se enlazan desde el pie del sitio.">
        <TextField id="sf-terms" label="Términos y condiciones" type="url" placeholder="https://" value={draft.legal.termsUrl} maxLength={300} disabled={lock} onChange={(termsUrl) => setLegal({ termsUrl })} />
        <TextField id="sf-privacy" label="Política de privacidad" type="url" placeholder="https://" value={draft.legal.privacyUrl} maxLength={300} disabled={lock} onChange={(privacyUrl) => setLegal({ privacyUrl })} />
        <TextField id="sf-returns" label="Cambios y devoluciones" type="url" placeholder="https://" value={draft.legal.returnsUrl} maxLength={300} disabled={lock} onChange={(returnsUrl) => setLegal({ returnsUrl })} />
      </Section>

      <Section title="Chat web" description="Incrustá el asistente en el sitio institucional. Solo responde en los sitios autorizados.">
        <SwitchField id="sf-chat-on" label="Chat web activado" checked={draft.webChat.enabled} disabled={lock} onChange={(enabled) => setWebChat({ enabled })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sf-chat-pos" label="Posición">
            {(a11y) => (
              <NativeSelect id="sf-chat-pos" value={draft.webChat.position} disabled={lock} onChange={(e) => setWebChat({ position: e.target.value === "left" ? "left" : "right" })} {...a11y}>
                <option value="right">Derecha</option>
                <option value="left">Izquierda</option>
              </NativeSelect>
            )}
          </Field>
          <TextField id="sf-chat-greeting" label="Saludo inicial" value={draft.webChat.greeting} maxLength={200} disabled={lock} onChange={(greeting) => setWebChat({ greeting })} />
        </div>
        <OriginsField origins={draft.webChat.allowedOrigins} disabled={lock} onChange={(allowedOrigins) => setWebChat({ allowedOrigins })} />
      </Section>

      <FormActions dirty={dirty} isSaving={isSaving} readOnly={readOnly} errorMessage={errorMessage} onReset={reset} />
    </form>
  )
}
