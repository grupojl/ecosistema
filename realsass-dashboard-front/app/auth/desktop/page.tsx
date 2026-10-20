'use client'
/**
 * app/auth/desktop/page.tsx — realsass-dashboard-front
 *
 * Último paso del login de la app de escritorio (DT-DESK-3). La app navega su webview acá con
 * `?code=…&verifier=…`: el código vino del navegador del sistema por el loopback (de un solo uso, 60 s) y el verifier
 * solo lo conoce la app. El back comprueba que coincidan, emite el custom token de Firebase y recién entonces se inicia sesión.
 *
 * Un código robado del loopback no sirve sin el verifier. Las dos credenciales se sacan de la URL apenas se leen.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter }               from 'next/navigation'
import { Loader2, CircleAlert }    from 'lucide-react'
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth'
import { getFirebaseAuth }         from '@real/auth-client'
import { trpc }                    from '@/lib/trpc/client'
import { isValidCode, isValidVerifier } from '@/lib/desktop'

export default function DesktopSsoPage() {
  const router = useRouter()
  const redeem = trpc.auth.redeemDesktopLogin.useMutation()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const params   = new URLSearchParams(window.location.search)
    const code     = params.get('code')
    const verifier = params.get('verifier')
    // Fuera de la barra de direcciones y del historial desde ya.
    window.history.replaceState(null, '', window.location.pathname)

    if (!isValidCode(code) || !isValidVerifier(verifier)) {
      setError('El enlace de inicio de sesión no es válido. Volvé a la aplicación e intentá de nuevo.')
      return
    }

    const run = async () => {
      try {
        const { customToken } = await redeem.mutateAsync({ code, verifier })
        const firebaseAuth = getFirebaseAuth()
        await signInWithCustomToken(firebaseAuth, customToken)
        await new Promise<void>((resolve, reject) => {
          const unsub = onAuthStateChanged(firebaseAuth, user => {
            unsub()
            if (user) resolve()
            else reject(new Error('Auth state null después de signInWithCustomToken'))
          })
        })
        router.replace('/')
      } catch {
        setError('No se pudo completar el inicio de sesión. Volvé a la aplicación e intentá de nuevo.')
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-4">
        <CircleAlert className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{error}</p>
        <a href="/login" className="inline-flex min-h-11 items-center text-sm underline">Ir al inicio de sesión</a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Completando el inicio de sesión…</p>
      </div>
    </div>
  )
}
