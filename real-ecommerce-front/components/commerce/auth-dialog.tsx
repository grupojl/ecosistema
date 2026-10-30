'use client'

/**
 * Ingreso del cliente con Google (Firebase). Ver ADR-021.
 * La UI es `LoginPanel` de @real/ui; los textos salen del diccionario de la tienda (idioma del visitante).
 */
import { useCallback } from 'react'
import {
  Alert, AlertDescription, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, GoogleIcon, LoginPanel,
  type LoginProvider,
} from '@real/ui'
import { useCommerce } from '@/components/commerce/commerce-provider'

export function AuthDialog() {
  const { authOpen, closeAuth, dict, signIn, authError, authUnavailable } = useCommerce()
  const c = dict.commerce
  const providers: readonly LoginProvider[] = [{ id: 'google', label: c.continueWithGoogle, icon: <GoogleIcon /> }]
  const onSignIn = useCallback(async () => { await signIn() }, [signIn])

  return (
    <Dialog open={authOpen} onOpenChange={(open) => { if (!open) closeAuth() }}>
      <DialogContent preset="form" size="sm">
        <DialogHeader className="sr-only">
          <DialogTitle>{c.authTitle}</DialogTitle>
          <DialogDescription>{c.authIntro}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6 pt-2">
          {authUnavailable && <Alert variant="destructive"><AlertDescription>{c.authUnavailable}</AlertDescription></Alert>}
          {authError && <Alert variant="destructive"><AlertDescription>{c.authError}</AlertDescription></Alert>}
          {!authUnavailable && (
            <LoginPanel
              providers={providers}
              onSignIn={onSignIn}
              onSuccess={closeAuth}
              title={c.authTitle}
              description={c.authIntro}
              connectingLabel={c.continuing}
              legal={null}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
