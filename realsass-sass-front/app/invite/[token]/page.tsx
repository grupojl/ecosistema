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
import { Building2, Check, X, Loader2, ShieldCheck, AlertCircle, LogIn } from 'lucide-react'
import { Button }                from '@real/ui'
import { useAuth }               from '@/context/auth-context'
import { useInvitationInfo, useAcceptInvitation } from '@/hooks/use-collaborators'
import { getErrorMessage }       from '@/lib/errors'

export default function InvitePage() {
  const params   = useParams<{ token: string }>()
  const router   = useRouter()
  const { firebaseUser, loading: authLoading } = useAuth()

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
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <X className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="font-semibold text-lg">Invitación inválida</h2>
        <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
        <Button variant="outline" onClick={() => router.push('/')}>Ir al inicio</Button>
      </div>
    </div>
  )

  if (!invitation) return null

  const org   = (invitation as any).collaborator?.organization
  const email = (invitation as any).collaborator?.email

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1,  y: 0  }}
        className="max-w-sm w-full space-y-6"
      >
        <div className="text-center space-y-2">
          <Building2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-xl font-semibold">Invitación a colaborar</h1>
          {org?.name && (
            <p className="text-muted-foreground text-sm">
              Fuiste invitado a <strong>{org.name}</strong>
            </p>
          )}
        </div>

        {!firebaseUser ? (
          <div className="rounded-xl border p-4 space-y-3 text-center">
            <ShieldCheck className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Necesitás iniciar sesión con <strong>{email}</strong> para aceptar la invitación
            </p>
            <Button className="w-full" onClick={() => router.push(`/?invite=${token}`)}>
              <LogIn className="h-4 w-4 mr-2" /> Iniciar sesión
            </Button>
          </div>
        ) : accept.isSuccess ? (
          <div className="rounded-xl border p-6 text-center space-y-3">
            <Check className="h-8 w-8 text-green-500 mx-auto" />
            <p className="font-medium">¡Invitación aceptada!</p>
            <Button className="w-full" onClick={() => router.push('/profile')}>
              Ir al perfil
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accept.error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {getErrorMessage(accept.error)}
              </div>
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
