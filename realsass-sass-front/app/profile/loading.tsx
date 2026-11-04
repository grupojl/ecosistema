import { LoadingState } from '@real/ui'

/**
 * Se muestra al instante al navegar a /profile, mientras el servidor prefetchea el perfil (auth.me) del back.
 * Mismo marco que page-content.tsx para que no haya salto de layout cuando llega el contenido real.
 */
export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-4 pt-8">
        <LoadingState rows={3} label="Cargando tu perfil…" />
      </div>
    </div>
  )
}
