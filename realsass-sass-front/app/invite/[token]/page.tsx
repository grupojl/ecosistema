'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Building2, Check, X, Loader2, ShieldCheck, AlertCircle, WifiOff, LogIn,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { AppError } from '@/lib/errors'
import type { InvitationInfo } from '@/lib/types'
import { acceptInvitation, getInvitationInfo } from '@/lib/api'

const PERMISSION_LABELS: Record<string, string> = {
  canViewListings:        'Ver propiedades',
  canCreateListings:      'Crear propiedades',
  canEditListings:        'Editar propiedades',
  canDeleteListings:      'Eliminar propiedades',
  canViewStats:           'Ver estadísticas',
  canManageLeads:         'Gestionar clientes',
  canManageCollaborators: 'Gestionar colaboradores',
}

type ErrorKind = 'NOT_FOUND' | 'EXPIRED' | 'NETWORK' | 'UNKNOWN'

function getErrorKind(err: unknown): { kind: ErrorKind; message: string } {
  if (err instanceof AppError) {
    if (err.code === 'NETWORK')   return { kind: 'NETWORK',   message: 'Sin conexión. Verificá tu red e intentá nuevamente.' }
    if (err.code === 'NOT_FOUND') return { kind: 'NOT_FOUND', message: 'La invitación no existe o ya fue usada.' }
    if (err.message.toLowerCase().includes('expir')) return { kind: 'EXPIRED', message: 'Esta invitación ya expiró.' }
  }
  if (err instanceof Error) return { kind: 'UNKNOWN', message: err.message }
  return { kind: 'UNKNOWN', message: 'Invitación inválida.' }
}

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token  = params?.token as string
  const { firebaseUser, loading: authLoading } = useAuth()

  const [info, setInfo]               = useState<InvitationInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [accepting, setAccepting]     = useState(false)
  const [accepted, setAccepted]       = useState(false)
  const [errorKind, setErrorKind]     = useState<ErrorKind | null>(null)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoadingInfo(true)
    getInvitationInfo(token)
      .then(res => setInfo(res.data))
      .catch(err => {
        const { kind, message } = getErrorKind(err)
        setErrorKind(kind)
        setErrorMsg(message)
      })
      .finally(() => setLoadingInfo(false))
  }, [token])

  const handleAccept = async () => {
    if (!firebaseUser) return
    setAccepting(true)
    setAcceptError(null)
    try {
      await acceptInvitation(token)
      setAccepted(true)
      setTimeout(() => router.push('/profile'), 2500)
    } catch (err) {
      const { message } = getErrorKind(err)
      setAcceptError(message)
    } finally {
      setAccepting(false)
    }
  }

  const activePerms = info
    ? Object.entries(info.permissions)
        .filter(([, v]) => v)
        .map(([k]) => PERMISSION_LABELS[k] ?? k)
    : []

  if (loadingInfo || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  // ── Error al cargar la invitación ─────────────────────────────────────────
  if (errorKind && !info) {
    const Icon = errorKind === 'NETWORK' ? WifiOff : X
    const title = errorKind === 'NETWORK'
      ? 'Sin conexión'
      : errorKind === 'EXPIRED'
      ? 'Invitación expirada'
      : 'Invitación no válida'

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-sm w-full rounded-3xl border border-border bg-card p-8 text-center shadow-xl"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 mx-auto">
            <Icon className="size-7 text-destructive" />
          </div>
          <h1 className="mt-4 font-serif text-xl text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
          {errorKind === 'NETWORK' && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Reintentar
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  // ── Invitación aceptada ───────────────────────────────────────────────────
  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="flex size-16 items-center justify-center rounded-full bg-green-100 mx-auto">
            <Check className="size-8 text-green-600" />
          </div>
          <h1 className="mt-4 font-serif text-2xl text-foreground">¡Bienvenido!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Redirigiendo a tu perfil...</p>
        </motion.div>
      </div>
    )
  }

  if (!info) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-sm w-full rounded-3xl border border-border bg-card p-8 shadow-xl"
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
          <Building2 className="size-6 text-primary" />
        </div>
        <h1 className="mt-4 text-center font-serif text-xl text-foreground">
          {info.organization.name ?? 'Una organización'}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          te invita a colaborar como miembro
        </p>

        {/* Permisos */}
        {activePerms.length > 0 && (
          <div className="mt-5 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tus permisos</p>
            {activePerms.map((perm) => (
              <div key={perm} className="flex items-center gap-2 text-sm text-foreground">
                <ShieldCheck className="size-4 text-primary shrink-0" />
                {perm}
              </div>
            ))}
          </div>
        )}

        {/* Error al aceptar */}
        {acceptError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {acceptError}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {firebaseUser ? (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {accepting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {accepting ? 'Aceptando...' : 'Aceptar invitación'}
            </button>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <LogIn className="mx-auto mb-2 size-5" />
              Iniciá sesión para aceptar esta invitación
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
