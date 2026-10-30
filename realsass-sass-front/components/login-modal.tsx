'use client'
/**
 * login-modal.tsx — realsass-sass-front
 *
 * Modal de acceso con Google, Apple y Facebook. La UI es `LoginPanel` de @real/ui (proveedores apilados, «Último usado»,
 * errores de Firebase traducidos); el modal cambia solo de forma: hoja inferior en compact, diálogo centrado desde medium.
 * Migrado de @/lib/firebase → @real/auth-client (ADR-006).
 */
import { useCallback, useMemo } from 'react'
import {
  AppleIcon, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, FacebookIcon, GoogleIcon, LoginPanel,
  type LoginProvider,
} from '@real/ui'
import { loginPanelTexts, useMessages } from '@real/i18n'
import type { Dictionary } from '@/lib/i18n'
import { signInWithGoogle, signInWithApple, signInWithFacebook } from '@real/auth-client'

interface LoginModalProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
}

const SIGN_IN: Record<string, () => Promise<unknown>> = {
  google:   signInWithGoogle,
  apple:    signInWithApple,
  facebook: signInWithFacebook,
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const d = useMessages<Dictionary>()
  const providers = useMemo<readonly LoginProvider[]>(() => [
    { id: 'google',   label: d.auth.continueWithGoogle,   icon: <GoogleIcon /> },
    { id: 'apple',    label: d.login.continueWithApple,    icon: <AppleIcon /> },
    { id: 'facebook', label: d.login.continueWithFacebook, icon: <FacebookIcon /> },
  ], [d])
  const onSignIn = useCallback(async (id: string) => { await SIGN_IN[id]?.() }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preset="form" size="sm">
        <DialogHeader className="sr-only">
          <DialogTitle>{d.login.title}</DialogTitle>
          <DialogDescription>{d.login.description}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2">
          <LoginPanel
            providers={providers}
            title={d.login.title}
            description={d.login.description}
            {...loginPanelTexts(d.auth)}
            onSignIn={onSignIn}
            onSuccess={() => onOpenChange(false)}
            lastUsedKey="sass-front:login:last"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
