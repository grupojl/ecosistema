'use client'
/**
 * app/invite/[token]/page.tsx — realsass-sass-front
 *
 * Página de aceptación de invitación de colaborador.
 * Migrado de lib/api fetch manual → hooks tRPC.
 * getInvitationInfo es @Public — no requiere auth para ver los datos.
 * acceptInvitation requiere auth — el usuario debe loguearse primero.
 */
import { useParams, useRouter }  from 'next/navigation'
import { motion }                from 'framer-motion'
import { Building2, Check, Loader2, ShieldCheck, LogIn } from 'lucide-react'
import { Alert, Button, EmptyState, Spinner, Card, PageHeader } from '@real/ui'
import { useAuth }               from '@/context/auth-context'
import { useInvitationInfo, useAcceptInvitation } from '@/hooks/use-collaborators'
import { getErrorMessage }       from '@/lib/errors'

export default function InvitePage() {
  const params   = useParams<{ token: string }>()
  const router   = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const token = params.token

  // @Public — carga sin auth
  const { data: invitation, isLoading, error } = useInvitationInfo(token)
  const accept = useAcceptInvitation()

  const handleAccept = async () => {
    await accept.mutateAsync({ token })
    router.push('/profile')
  }

  if (isLoading || authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <EmptyState
        kind="error"
        className="max-w-sm w-full"
        title="Invitación inválida"
        description={getErrorMessage(error)}
        action={<Button variant="outline" onClick={() => router.push('/')}>Ir al inicio</Button>}
      />
    </div>
  )

  if (!invitation) return null

  const org   = invitation?.collaborator?.organization
  const email = invitation?.collaborator?.email

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1,  y: 0  }}
        className="max-w-sm w-full space-y-6"
      >
        <div className="space-y-2 text-center">
          <Building2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
          <PageHeader
            className="text-center"
            title="Invitación a colaborar"
            description={org?.name ? <>Fuiste invitado a <strong>{org.name}</strong></> : undefined}
          />
        </div>

        {!isAuthenticated ? (
          <Card className="p-4 space-y-3 text-center">
            <ShieldCheck className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Necesitás iniciar sesión con <strong>{email}</strong> para aceptar la invitación
            </p>
            <Button className="w-full" onClick={() => router.push(`/?invite=${token}`)}>
              <LogIn className="h-4 w-4 mr-2" /> Iniciar sesión
            </Button>
          </Card>
        ) : accept.isSuccess ? (
          <Card className="p-6 text-center space-y-3">
            <Check className="h-8 w-8 text-success-ink mx-auto" />
            <p className="font-medium">¡Invitación aceptada!</p>
            <Button className="w-full" onClick={() => router.push('/profile')}>
              Ir al perfil
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {accept.error && (
              <Alert variant="destructive">{getErrorMessage(accept.error)}</Alert>
            )}
            <Button
              className="w-full"
              disabled={accept.isPending}
              onClick={handleAccept}
            >
              {accept.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Check className="h-4 w-4 mr-2" />}
              Aceptar invitación
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
              Cancelar
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
