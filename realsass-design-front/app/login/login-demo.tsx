'use client'

import { useRef, useState } from 'react'
import { Palette } from 'lucide-react'
import {
  AppleIcon, AUTH_ERRORS, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field, GithubIcon, GoogleIcon,
  LoginPanel, MicrosoftIcon, NativeSelect, Tabs, TabsContent, TabsList, TabsTrigger, toast,
  type LoginEmailFlow, type LoginProvider,
} from '@/components/ui'

const PROVIDERS: readonly LoginProvider[] = [
  { id: 'google', label: 'Continuar con Google', icon: <GoogleIcon /> },
  { id: 'microsoft', label: 'Continuar con Microsoft', icon: <MicrosoftIcon /> },
  { id: 'apple', label: 'Continuar con Apple', icon: <AppleIcon /> },
  { id: 'github', label: 'Continuar con GitHub', icon: <GithubIcon /> },
]

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function Logo() {
  return <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md" aria-hidden="true"><Palette className="size-6" /></span>
}

function Brand() {
  return (
    <div className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground @[44rem]:flex @[44rem]:flex-col @[44rem]:justify-between">
      <span className="absolute -right-24 -top-20 size-72 rounded-full bg-primary-foreground/10" aria-hidden="true" />
      <span className="absolute -bottom-16 -left-16 size-48 rounded-full bg-primary-foreground/10" aria-hidden="true" />
      <div className="relative flex items-center gap-2 font-display text-lg font-semibold"><Palette className="size-5" aria-hidden="true" /> Welver</div>
      <div className="relative space-y-3">
        <p className="font-display text-3xl font-semibold leading-tight text-balance">Atención al ciudadano, clara y disponible las 24 horas.</p>
        <p className="text-primary-foreground/80">Gestiona tu negocio desde un solo panel, en el celular o en la computadora.</p>
      </div>
    </div>
  )
}

export function LoginDemo() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('none')
  // La demostración lanza el error elegido en el próximo intento, como lo haría Firebase.
  const errorRef = useRef(error)
  errorRef.current = error

  const onSignIn = async () => {
    await wait(1100)
    if (errorRef.current !== 'none') throw { code: errorRef.current }
  }
  const emailFlow: LoginEmailFlow = {
    sendCode: async () => {
      await wait(800)
      if (errorRef.current === 'auth/network-request-failed') throw { code: errorRef.current }
      toast.info('Código enviado', { description: 'En esta demostración el código es 123456.' })
    },
    verifyCode: async (_email, code) => { await wait(700); if (code !== '123456') throw { code: 'auth/invalid-verification-code' } },
  }
  const done = (how: string) => { setOpen(false); toast.success('Sesión iniciada', { description: `Entraste ${how}. Cuenta nueva o existente: el mismo flujo sirve para ambas.` }) }
  const panel = <LoginPanel providers={PROVIDERS} onSignIn={onSignIn} onSuccess={done} emailFlow={emailFlow} logo={<Logo />} lastUsedKey="design:login:last" />

  return (
    <div className="space-y-4">
      <div className="grid gap-3 medium:grid-cols-2">
        <Field id="lg-sim" label="Simular un error de Firebase" hint="El próximo intento de acceso falla con este código.">
          {() => (
            <NativeSelect id="lg-sim" value={error} onChange={(e) => setError(e.target.value)}>
              <option value="none">Sin error</option>
              {Object.keys(AUTH_ERRORS).filter((k) => k !== 'auth/invalid-verification-code').map((k) => <option key={k} value={k}>{k}</option>)}
              <option value="auth/popup-closed-by-user">auth/popup-closed-by-user (no es un error)</option>
            </NativeSelect>
          )}
        </Field>
      </div>

      <Tabs defaultValue="modal">
        <TabsList>
          <TabsTrigger value="modal">Modal</TabsTrigger>
          <TabsTrigger value="page">Página completa</TabsTrigger>
        </TabsList>

        <TabsContent value="modal" className="space-y-3">
          <p className="text-sm text-muted-foreground">Se abre encima de lo que estés haciendo: hoja inferior en compact y diálogo centrado en medium y expanded.</p>
          <Button onClick={() => setOpen(true)}>Iniciar sesión</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent preset="form" size="sm">
              <DialogHeader className="sr-only"><DialogTitle>Iniciar sesión</DialogTitle><DialogDescription>Elige cómo quieres entrar a tu panel.</DialogDescription></DialogHeader>
              <div className="px-6 pb-6 pt-2">{panel}</div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="page">
          <p className="mb-3 text-sm text-muted-foreground">Pantalla de acceso con panel de marca: el panel aparece solo cuando el contenedor es ancho (consulta de contenedor, no de viewport).</p>
          <div className="overflow-hidden rounded-xl border [container-type:inline-size]">
            <div className="grid min-h-[30rem] @[44rem]:grid-cols-[1fr_1.1fr]">
              <Brand />
              <div className="flex flex-col justify-center px-5 py-8 @[30rem]:px-8">
                <div className="mx-auto w-full max-w-sm">{panel}</div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
