'use client'

/**
 * Barra superior de la landing — patrón «Topbar» de welver.html: sticky, 56 px, fondo con desenfoque y filete inferior.
 * En compact la navegación por secciones vive en la barra inferior (`SectionTabBar`); acá solo van marca, cuenta y tema.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, LogOut, User } from 'lucide-react'
import {
  Avatar, AvatarFallback, AvatarImage, Button, SiteBrand, SiteHeader, ThemeToggle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@real/ui'
import { LocaleSwitcher, useMessages } from '@real/i18n'
import { LoginModal } from '@/components/login-modal'
import type { Dictionary } from '@/lib/i18n'
import { useAuth } from '@/context/auth-context'
import { useImageReady } from '@/hooks/use-image-ready'
import { initialsOf, readAuthHint, type AuthHint } from '@/lib/auth-hint'
import { SECTION_LINKS } from '@/components/section-links'

export function Navbar() {
  const [loginOpen, setLoginOpen] = useState(false)
  const { firebaseUser, isAuthenticated, profile, loading, logout } = useAuth()
  const router = useRouter()
  const d = useMessages<Dictionary>()

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
      <SiteHeader
        brand={<SiteBrand name="Propiedad" icon={<Building2 />} label="Propiedad — inicio" />}
        links={SECTION_LINKS.filter((l) => l.id !== 'top').map((l) => ({ id: l.id, label: l.label, href: `#${l.id}` }))}
        actions={
          <>
            <LocaleSwitcher label={d.common.language} compact />
            <ThemeToggle compact />

            {/* Cuenta */}
            {avatarPending ? (
              // Mismo tamaño que el avatar real: sin saltos de layout al resolverse.
              <div className="flex h-11 w-11 items-center justify-center" aria-busy="true" aria-label={d.nav.loadingSession}>
                <span className="size-8 animate-pulse rounded-full bg-primary/10" />
              </div>
            ) : resolving ? (
              // Hay pista del último usuario pero la sesión aún se verifica: se ve su avatar, sin menú hasta confirmarlo.
              <div className="flex h-11 w-11 items-center justify-center" aria-busy="true">
                <Avatar className="size-8 border-2 border-primary/20">
                  {photoURL && <AvatarImage src={photoURL} alt={d.nav.avatarAlt} referrerPolicy="no-referrer" />}
                  <AvatarFallback className="bg-primary/10 font-medium text-primary">{initials}</AvatarFallback>
                </Avatar>
              </div>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label={d.nav.userMenu}>
                    <Avatar className="size-8 border-2 border-primary/20">
                      {photoURL && <AvatarImage src={photoURL} alt="Avatar" referrerPolicy="no-referrer" />}
                      <AvatarFallback className="bg-primary/10 font-medium text-primary">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-xs text-muted-foreground">
                      {profile?.user.email ?? firebaseUser?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="size-4" />
                    {d.nav.profile}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive-ink focus:text-destructive-ink" onClick={logout}>
                    <LogOut className="size-4" />
                    {d.nav.signOut}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={() => setLoginOpen(true)}>
                {d.nav.signIn}
              </Button>
            )}
          </>
        }
      />

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
