'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsMobile } from '@/components/ui/use-mobile'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import {
  signInWithGoogle,
  signInWithApple,
  signInWithFacebook,
} from '@/lib/firebase'
import { Loader2 } from 'lucide-react'

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.53-3.23 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
    </svg>
  )
}

type Provider = 'google' | 'apple' | 'facebook'

function AuthButtons({ onSuccess }: { onSuccess: () => void }) {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (provider: Provider) => {
    setLoadingProvider(provider)
    setError(null)
    try {
      if (provider === 'google')   await signInWithGoogle()
      if (provider === 'apple')    await signInWithApple()
      if (provider === 'facebook') await signInWithFacebook()
      onSuccess()
    } catch (err: any) {
      // Ignorar cancelación del popup
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError('Error al iniciar sesión. Intentá de nuevo.')
      }
    } finally {
      setLoadingProvider(null)
    }
  }

  const buttons = [
    { provider: 'google'   as Provider, icon: <GoogleIcon />,   label: 'Continuar con Google',   style: 'border border-border bg-card text-card-foreground hover:bg-secondary' },
    { provider: 'apple'    as Provider, icon: <AppleIcon />,    label: 'Continuar con Apple',    style: 'bg-foreground text-background hover:opacity-90' },
    { provider: 'facebook' as Provider, icon: <FacebookIcon />, label: 'Continuar con Facebook', style: 'border border-border bg-card text-card-foreground hover:bg-secondary' },
  ]

  return (
    <div className="flex flex-col gap-3 px-1">
      {buttons.map(({ provider, icon, label, style }) => {
        const isLoading = loadingProvider === provider
        return (
          <button
            key={provider}
            onClick={() => handleLogin(provider)}
            disabled={!!loadingProvider}
            className={`flex h-12 w-full items-center justify-center gap-3 rounded-lg text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] ${style}`}
          >
            {isLoading ? <Loader2 className="size-5 animate-spin" /> : icon}
            <span>{isLoading ? 'Conectando…' : label}</span>
          </button>
        )
      })}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1 text-center text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
        {'Al continuar, aceptás nuestros '}
        <a href="#" className="underline hover:text-foreground">Términos de Servicio</a>
        {' y '}
        <a href="#" className="underline hover:text-foreground">Política de Privacidad</a>
      </p>
    </div>
  )
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const isMobile = useIsMobile()
  const router   = useRouter()

  const handleSuccess = () => {
    onOpenChange(false)
    // El AuthProvider detecta el cambio de estado y hace sync automáticamente.
    // Redirigimos al perfil donde el usuario puede configurar su cuenta.
    router.push('/profile')
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle className="font-serif text-xl text-foreground">Bienvenido</DrawerTitle>
            <DrawerDescription className="text-muted-foreground">
              Iniciá sesión para acceder a tu cuenta.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-8">
            <AuthButtons onSuccess={handleSuccess} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-card sm:max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="font-serif text-2xl text-foreground">Bienvenido</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Iniciá sesión para acceder a tu cuenta.
          </DialogDescription>
        </DialogHeader>
        <AuthButtons onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  )
}