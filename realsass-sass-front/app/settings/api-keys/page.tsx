'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Lock } from 'lucide-react'
import { Button, EmptyState, LoadingState, PageContainer, PageHeader } from '@real/ui'
import { useAuth } from '@/context/auth-context'

/**
 * Página de API Keys — placeholder listo para cuando se integre
 * al ecosistema principal con ApiKeyModule del organizaciones-back.
 */
export default function ApiKeysPage() {
  const router = useRouter()
  const { isAuthenticated, profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/')
  }, [loading, isAuthenticated, router])

  if (loading || !profile) {
    return (
      <PageContainer size="sm">
        <LoadingState rows={3} label="Cargando API Keys…" />
      </PageContainer>
    )
  }

  // Dueño = tiene organización propia (los colaboradores solo tienen `collaborations`)
  if (!profile.organization) {
    return (
      <PageContainer size="sm" className="pt-16">
        <EmptyState
          kind="forbidden"
          icon={<Lock className="size-5" />}
          title="Solo los owners pueden gestionar API Keys"
          description="Pedí acceso al propietario de la organización."
          action={<Button variant="outline" size="sm" onClick={() => router.push('/profile')}>Volver al perfil</Button>}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer size="sm">
      <PageHeader
        icon={<KeyRound />}
        title="API Keys"
        description="Gestioná las claves de acceso para integraciones externas."
      />
      <EmptyState title="Disponible en la próxima versión" description="El módulo de API Keys llega pronto." />
    </PageContainer>
  )
}
