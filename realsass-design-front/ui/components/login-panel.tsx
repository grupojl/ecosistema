"use client"

/**
 * LoginPanel — acceso mínimo, sin campos de contraseña (welver.html → «Inicio de sesión»).
 * Proveedores apilados a ancho completo (objetivo de 46 px) + «Último usado» + correo con código opcional.
 * Errores de Firebase traducidos sin culpar; cerrar la ventana del proveedor NO es un error.
 *
 *   <Dialog><DialogContent preset="form" size="sm"><LoginPanel providers={…} onSignIn={…} onSuccess={…} /></DialogContent></Dialog>
 *
 * Es agnóstico del SDK: recibe `onSignIn(id)` y lanza el error de Firebase (`{ code: 'auth/…' }`) si algo falla.
 */
import * as React from "react"
import { ArrowLeft, CircleCheck, Loader2, Mail, ShieldCheck } from "lucide-react"

import { cn } from "@real/ui/utils"
import { Alert, AlertDescription, AlertTitle } from "./alert"
import { Badge } from "./badge"
import { Button } from "./button"
import { Field } from "./field"
import { Input } from "./input"
import { toast } from "./toast"

export interface LoginProvider {
  id: string
  /** Texto completo del botón, p. ej. «Continuar con Google». */
  label: string
  icon: React.ReactNode
}

export interface LoginEmailFlow {
  /** Envía el código al correo. Lanza si falla. */
  sendCode: (email: string) => Promise<void>
  /** Verifica el código. Lanza `{ code: 'auth/invalid-verification-code' }` si no coincide. */
  verifyCode: (email: string, code: string) => Promise<void>
}

/** Textos traducibles del acceso (Google). Lo que no se pasa queda en español. */
export interface LoginPanelMessages {
  /** Error por código de Firebase (auth/…): título y texto; la variante visual se conserva. */
  errors?: Partial<Record<string, { title: string; text: string }>>
  genericError?: { title: string; text: string }
  signedInTitle?: string
  signedInText?: string
}

export interface LoginPanelProps {
  providers: readonly LoginProvider[]
  onSignIn: (providerId: string) => Promise<void>
  /** Se llama al terminar bien. `how` describe el método («con Google»). */
  onSuccess?: (how: string) => void
  /** Si se pasa, aparece «Continuar con el correo» (código de 6 dígitos). */
  emailFlow?: LoginEmailFlow
  logo?: React.ReactNode
  title?: string
  description?: string
  /** Pie legal; por defecto términos y privacidad. Con `null` se oculta. */
  legal?: React.ReactNode | null
  /** Clave de localStorage para recordar el último proveedor usado. */
  lastUsedKey?: string
  /** Textos del botón en curso y de la insignia, para tiendas en otros idiomas. */
  connectingLabel?: string
  lastUsedLabel?: string
  /** Nivel del título: h1 cuando el panel es la página entera; h3 (por defecto) dentro de un modal. */
  headingAs?: "h1" | "h2" | "h3"
  /** Traducciones de errores y del cartel de éxito. */
  messages?: LoginPanelMessages
  className?: string
}

type Variant = "warning" | "destructive"
interface Message { variant: Variant; title: string; text: string }

/** Errores de Firebase Authentication: qué pasó + qué hacer, sin culpar. */
export const AUTH_ERRORS: Record<string, Message> = {
  "auth/popup-blocked": { variant: "warning", title: "Tu navegador bloqueó la ventana", text: "Permite las ventanas emergentes para este sitio e inténtalo de nuevo." },
  "auth/account-exists-with-different-credential": { variant: "warning", title: "Ese correo ya tiene una cuenta", text: "Entra con el método que usaste la primera vez. Después podrás vincular los demás." },
  "auth/network-request-failed": { variant: "destructive", title: "Sin conexión", text: "Revisa tu internet y vuelve a intentarlo. No perdiste nada." },
  "auth/unauthorized-domain": { variant: "destructive", title: "Este sitio no está autorizado", text: "Avisa al equipo para habilitar el dominio." },
  "auth/too-many-requests": { variant: "warning", title: "Demasiados intentos", text: "Espera un minuto antes de volver a probar." },
  "auth/invalid-verification-code": { variant: "warning", title: "El código no coincide", text: "Revisa los 6 dígitos o pide uno nuevo." },
}
const GENERIC: Message = { variant: "destructive", title: "No pudimos iniciar sesión", text: "Inténtalo de nuevo en unos segundos. Tus datos están a salvo." }
/** Cerrar la ventana del proveedor es una decisión de la persona, no un error. */
const CANCELLED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"])

const codeOf = (e: unknown) => (typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "")

function useLastUsed(key?: string): [string | null, (id: string) => void] {
  const [last, setLast] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!key) return
    try { setLast(window.localStorage.getItem(key)) } catch { /* sin almacenamiento */ }
  }, [key])
  const save = React.useCallback((id: string) => {
    setLast(id)
    if (!key) return
    try { window.localStorage.setItem(key, id) } catch { /* idem */ }
  }, [key])
  return [last, save]
}

type Step = "start" | "email" | "code" | "done"

export function LoginPanel({
  providers, onSignIn, onSuccess, emailFlow, logo, title = "Entra a tu panel",
  description = "Elige cómo quieres entrar. Si es tu primera vez, creamos tu cuenta solos.", legal, lastUsedKey, className,
  connectingLabel = "Conectando…", lastUsedLabel = "Último usado", headingAs: Heading = "h3", messages,
}: LoginPanelProps) {
  const [step, setStep] = React.useState<Step>("start")
  const [busy, setBusy] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<Message | null>(null)
  const [last, setLast] = useLastUsed(lastUsedKey)
  const [email, setEmail] = React.useState("")
  const [emailErr, setEmailErr] = React.useState<string>()
  const [code, setCode] = React.useState("")
  const [left, setLeft] = React.useState(0)
  const codeRef = React.useRef<HTMLInputElement>(null)
  const loading = busy !== null

  React.useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft((s) => s - 1), 1000); return () => clearTimeout(t) }, [left])
  React.useEffect(() => { if (step === "code") codeRef.current?.focus() }, [step])

  const fail = (e: unknown) => {
    const c = codeOf(e)
    if (CANCELLED.has(c)) return
    const base = AUTH_ERRORS[c] ?? GENERIC
    const over = AUTH_ERRORS[c] ? messages?.errors?.[c] : messages?.genericError
    setMessage(over ? { ...base, ...over } : base)
  }

  const provider = async (p: LoginProvider) => {
    setBusy(p.id); setMessage(null)
    try {
      await onSignIn(p.id)
      setLast(p.id)
      onSuccess?.(`con ${p.label.replace(/^Continuar con /, "")}`)
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  const sendCode = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!emailFlow) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setEmailErr("El correo no es válido. Revisa que tenga el formato nombre@dominio.com."); return }
    setEmailErr(undefined); setBusy("email"); setMessage(null)
    try {
      await emailFlow.sendCode(email)
      setStep("code"); setLeft(30)
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  const verify = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!emailFlow) return
    setBusy("code"); setMessage(null)
    try {
      await emailFlow.verifyCode(email, code)
      setStep("done")
      onSuccess?.("con un código por correo")
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  if (step === "done") {
    return (
      <div className={cn("space-y-3 py-4 text-center", className)} role="status">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-success/15 text-success-ink"><CircleCheck className="size-6" aria-hidden="true" /></span>
        <p className="font-display text-lg font-semibold">{messages?.signedInTitle ?? "Sesión iniciada"}</p>
        <p className="text-sm text-muted-foreground">{messages?.signedInText ?? "Te llevamos a tu panel en un momento."}</p>
      </div>
    )
  }

  const heading = step === "start" ? title : step === "email" ? "Entra con tu correo" : "Revisa tu correo"
  const sub = step === "start" ? description : step === "email" ? "Te enviamos un código de 6 dígitos. Sin contraseñas." : `Escribe el código que enviamos a ${email}.`

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col items-center gap-2 text-center">
        {logo}
        <Heading className="font-display text-xl font-semibold tracking-tight">{heading}</Heading>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </div>

      <div aria-live="polite">
        {message && <Alert variant={message.variant}><AlertTitle>{message.title}</AlertTitle><AlertDescription>{message.text}</AlertDescription></Alert>}
      </div>

      {step === "start" && (
        <>
          <ul className="grid gap-2.5">
            {providers.map((p) => (
              <li key={p.id}>
                <button
                  type="button" disabled={loading} aria-busy={busy === p.id} onClick={() => provider(p)}
                  className="grid min-h-[2.875rem] w-full grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-lg border bg-background px-4 text-left text-[0.9375rem] font-medium transition hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[.985] disabled:opacity-60 aria-busy:opacity-100"
                >
                  <span className="grid place-items-center">{busy === p.id ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : p.icon}</span>
                  <span>{busy === p.id ? connectingLabel : p.label}</span>
                  {last === p.id && busy !== p.id && <Badge variant="secondary">{lastUsedLabel}</Badge>}
                </button>
              </li>
            ))}
          </ul>
          {emailFlow && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator" aria-label="o"><span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" /></div>
              <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => setStep("email")}><Mail /> Continuar con el correo</Button>
            </>
          )}
        </>
      )}

      {step === "email" && emailFlow && (
        <form noValidate onSubmit={sendCode} className="space-y-3">
          <Field id="login-email" label="Correo electrónico" error={emailErr}>
            {(a) => <Input id="login-email" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} {...a} />}
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>{busy === "email" ? "Enviando…" : "Enviar código"}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("start")}><ArrowLeft /> Otras opciones</Button>
        </form>
      )}

      {step === "code" && emailFlow && (
        <form noValidate onSubmit={verify} className="space-y-3">
          <Field id="login-code" label="Código de 6 dígitos">
            {(a) => <Input id="login-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="text-center font-mono text-lg tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} {...a} />}
          </Field>
          <Button type="submit" className="w-full" disabled={loading || code.length < 6}>{busy === "code" ? "Verificando…" : "Entrar"}</Button>
          <div className="flex items-center justify-between text-sm">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep("email")}><ArrowLeft /> Cambiar correo</Button>
            <Button
              type="button" variant="ghost" size="sm" disabled={left > 0}
              onClick={async () => { try { await emailFlow.sendCode(email); setLeft(30); toast.info("Código reenviado") } catch (e) { fail(e) } }}
            >
              {left > 0 ? `Reenviar en ${left} s` : "Reenviar código"}
            </Button>
          </div>
        </form>
      )}

      {legal !== null && (
      <p className="text-balance text-center text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
          <span>{legal ?? <>Al continuar aceptas los <a className="underline underline-offset-2" href="#terminos">términos</a> y la <a className="underline underline-offset-2" href="#privacidad">política de privacidad</a>.</>}</span>
        </p>
      )}
    </div>
  )
}
