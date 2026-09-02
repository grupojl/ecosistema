'use client'
/**
 * login-modal.tsx — realsass-sass-front
 *
 * Modal/Drawer de login con Google, Apple y Facebook.
 * Migrado de @/lib/firebase → @real/auth-client (ADR-006).
 */
import { useState }          from 'react'
import { useRouter }         from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 }           from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Drawer,  DrawerContent,  DrawerHeader,  DrawerTitle,  DrawerDescription,
  useIsMobile,
} from '@real/ui'
import {
  signInWithGoogle,
  signInWithApple,
  signInWithFacebook,
} from '@real/auth-client'

interface LoginModalProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#1877F2]">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

type Provider = 'google' | 'apple' | 'facebook'

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const router    = useRouter()
  const isMobile  = useIsMobile()
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const handleLogin = async (provider: Provider) => {
    setLoading(provider)
    setError(null)
    try {
      if (provider === 'google')   await signInWithGoogle()
      if (provider === 'apple')    await signInWithApple()
      if (provider === 'facebook') await signInWithFacebook()
      onOpenChange(false)
    } catch (err: unknown) {
      // Ignorar cancelación del popup
      const msg = (err as any)?.code
      if (msg === 'auth/popup-closed-by-user' || msg === 'auth/cancelled-popup-request') return
      setError('Error al iniciar sesión. Intentá de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const content = (
    <div className="space-y-4 p-1">
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {(['google', 'apple', 'facebook'] as Provider[]).map(provider => (
        <button
          key={provider}
          disabled={!!loading}
          onClick={() => handleLogin(provider)}
          className="flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
        >
          {loading === provider
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : provider === 'google'   ? <GoogleIcon />
            : provider === 'apple'    ? <AppleIcon />
            : <FacebookIcon />
          }
          Continuar con {provider.charAt(0).toUpperCase() + provider.slice(1)}
        </button>
      ))}
    </div>
  )

  const title       = 'Iniciar sesión'
  const description = 'Elegí tu método de autenticación para continuar'

  if (isMobile) return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-4 pb-8">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
