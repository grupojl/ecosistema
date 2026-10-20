'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Menu, X, LogOut, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@real/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@real/ui'
import { LoginModal } from '@/components/login-modal'
import { useAuth } from '@/context/auth-context'
import { useImageReady } from '@/hooks/use-image-ready'
import { initialsOf, readAuthHint, type AuthHint } from '@/lib/auth-hint'

const navLinks = [
  { label: 'Features',  href: '#features'  },
  { label: 'Pricing',   href: '#pricing'   },
  { label: 'Reviews',   href: '#reviews'   },
  { label: 'Contact',   href: '#contact'   },
]

export function Navbar() {
  const [loginOpen, setLoginOpen]       = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { firebaseUser, isAuthenticated, profile, loading, logout } = useAuth()
  const router = useRouter()

  // Pista del último usuario (se lee tras montar: en el servidor no hay localStorage y desfasaría la hidratación).
  const [hint, setHint] = useState<AuthHint | null>(null)
  useEffect(() => { setHint(readAuthHint(window.localStorage)) }, [])

  // Tope del esqueleto: si la sesión tarda demasiado (p. ej. Firebase lento para un visitante sin sesión), se muestra el acceso normal.
  const [waitedTooLong, setWaitedTooLong] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setWaitedTooLong(true), 2000)
    return () => clearTimeout(t)
  }, [])

  // Todavía no se sabe si hay sesión: ni "U" de invitado ni iniciales a medias; un hueco del mismo tamaño o la pista.
  const resolving = loading && !isAuthenticated && !(waitedTooLong && !hint)
  const initials = profile ? initialsOf(profile.user.email)
    : firebaseUser ? initialsOf(firebaseUser.email)
    : hint?.initials ?? 'U'
  // El perfil llega antes (cookie, 1 request) que el usuario de Firebase: se prefiere su foto para no esperar a Firebase.
  const photoURL = profile?.user.photoUrl ?? firebaseUser?.photoURL ?? (resolving ? hint?.photoUrl : null) ?? undefined

  // La foto se descarga antes de pintar el avatar: así aparece completo (foto o iniciales) y no "salta" de iniciales a foto.
  const imageReady = useImageReady(isAuthenticated || (resolving && hint) ? photoURL : undefined)
  const avatarPending = (resolving && !hint) || ((isAuthenticated || resolving) && !imageReady)

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
        className="fixed top-0 right-0 left-0 z-50 border-b border-border/40 backdrop-blur-xl"
        style={{ backgroundColor: 'rgba(245, 240, 235, 0.8)' }}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-18 lg:px-8">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl tracking-tight text-foreground md:text-2xl">
              Propiedad
            </span>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-12 w-12 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary md:hidden"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            {/* Avatar / Login trigger */}
            {avatarPending ? (
              // Mismo tamaño que el avatar real (botón de 48 px, avatar de 36 px): sin saltos de layout al resolverse.
              <div className="flex h-12 w-12 items-center justify-center" aria-busy="true" aria-label="Cargando sesión">
                <span className="size-9 animate-pulse rounded-full bg-primary/10" />
              </div>
            ) : resolving ? (
              // Hay pista del último usuario pero la sesión aún se verifica: se ve su avatar, sin menú hasta confirmarlo.
              <div className="flex h-12 w-12 items-center justify-center" aria-busy="true">
                <Avatar className="size-9 border-2 border-primary/20">
                  {photoURL && <AvatarImage src={photoURL} alt="Avatar" referrerPolicy="no-referrer" />}
                  <AvatarFallback className="bg-primary/10 font-medium text-primary">{initials}</AvatarFallback>
                </Avatar>
              </div>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
                    aria-label="Menú de usuario"
                  >
                    <Avatar className="size-9 border-2 border-primary/20">
                      {photoURL && <AvatarImage src={photoURL} alt="Avatar" referrerPolicy="no-referrer" />}
                      <AvatarFallback className="bg-primary/10 font-medium text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground truncate">
                      {profile?.user.email ?? firebaseUser?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="size-4" />
                    Mi perfil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={logout}
                  >
                    <LogOut className="size-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
                aria-label="Iniciar sesión"
              >
                <Avatar className="size-9 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 font-medium text-primary">
                    U
                  </AvatarFallback>
                </Avatar>
              </button>
            )}
          </div>
        </nav>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/40 px-4 pb-4 md:hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex h-12 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </motion.div>
        )}
      </motion.header>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
