'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'

// Skeleton para el estado de carga
function ApiKeysSkeleton() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 animate-pulse">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

/**
 * Página de API Keys — placeholder listo para cuando se integre
 * al ecosistema principal con ApiKeyModule del organizaciones-back.
 */
export default function ApiKeysPage() {
  const router = useRouter()
  const { firebaseUser, profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/')
  }, [loading, firebaseUser, router])

  if (loading || !profile) return <ApiKeysSkeleton />

  if (!profile.isOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-muted-foreground">
            Solo los owners pueden gestionar API Keys.
          </p>
          <button
            onClick={() => router.push('/profile')}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Volver al perfil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-2xl text-foreground">API Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestioná las claves de acceso para integraciones externas.
        </p>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Módulo de API Keys disponible en la próxima versión.
          </p>
        </div>
      </div>
    </div>
  )
}
