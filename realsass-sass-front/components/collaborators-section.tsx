'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Trash2, Copy, Check, Loader2,
  AlertCircle, Mail, ShieldCheck, UserX,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import {
  listCollaborators,
  inviteCollaborator,
  removeCollaborator,
  updateCollaboratorPermissions,
} from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Collaborator, CollaboratorPermissions } from '@/lib/types'

const PERMISSION_LABELS: Array<{ key: keyof CollaboratorPermissions; label: string }> = [
  { key: 'canViewListings',        label: 'Ver propiedades'       },
  { key: 'canCreateListings',      label: 'Crear propiedades'     },
  { key: 'canEditListings',        label: 'Editar propiedades'    },
  { key: 'canDeleteListings',      label: 'Eliminar propiedades'  },
  { key: 'canViewStats',           label: 'Ver estadísticas'      },
  { key: 'canManageLeads',         label: 'Gestionar clientes'    },
  { key: 'canManageCollaborators', label: 'Gestionar colaboradores' },
]

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  ACTIVE:  'Activo',
  REMOVED: 'Removido',
}

// ── Estado vacío ──────────────────────────────────────────────────────────────
function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Users className="size-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-medium text-foreground">Aún no tenés colaboradores</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        Invitá a miembros de tu equipo para que puedan acceder a tu organización.
      </p>
      <button
        onClick={onInvite}
        className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="size-4" />
        Invitar primer colaborador
      </button>
    </div>
  )
}

// ── Fila de colaborador ───────────────────────────────────────────────────────
function CollaboratorRow({
  collab,
  onRemove,
}: {
  collab: Collaborator
  onRemove: (id: string) => void
}) {
  const [removing, setRemoving] = useState(false)
  const [copied, setCopied]     = useState(false)

  const handleCopy = () => {
    if (!collab.invitation?.token) return
    const link = `${window.location.origin}/invite/${collab.invitation.token}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRemove = async () => {
    if (!confirm(`¿Remover a ${collab.email}?`)) return
    setRemoving(true)
    try {
      await removeCollaborator(collab.id)
      onRemove(collab.id)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{collab.email}</p>
        <p className="text-xs text-muted-foreground">
          {STATUS_LABELS[collab.status] ?? collab.status}
        </p>
      </div>

      <div className="ml-3 flex items-center gap-2">
        {/* Copiar link si está pendiente */}
        {collab.status === 'PENDING' && collab.invitation && (
          <button
            onClick={handleCopy}
            title="Copiar link de invitación"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
          </button>
        )}

        {/* Remover */}
        {collab.status !== 'REMOVED' && (
          <button
            onClick={handleRemove}
            disabled={removing}
            title="Remover colaborador"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          >
            {removing
              ? <Loader2 className="size-4 animate-spin" />
              : <Trash2 className="size-4" />
            }
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Modal de invitación ───────────────────────────────────────────────────────
function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void
  onInvited: (collab: Collaborator, link: string) => void
}) {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [perms, setPerms]   = useState<CollaboratorPermissions>({
    canViewListings:        true,
    canCreateListings:      false,
    canEditListings:        false,
    canDeleteListings:      false,
    canViewStats:           false,
    canManageLeads:         false,
    canManageCollaborators: false,
  })

  const togglePerm = (key: keyof CollaboratorPermissions) =>
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await inviteCollaborator({ email: email.trim(), ...perms })
      onInvited(res.data.collaborator, res.data.inviteLink)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl"
      >
        <h2 className="font-serif text-lg text-foreground">Invitar colaborador</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresá el email y configurá los permisos de acceso.
        </p>

        <input
          type="email"
          placeholder="email@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-4 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          autoFocus
        />

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Permisos</p>
          {PERMISSION_LABELS.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={perms[key]}
                onChange={() => togglePerm(key)}
                className="size-4 rounded accent-primary"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !email.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {loading ? 'Enviando...' : 'Enviar invitación'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Banner de éxito post-invitación ───────────────────────────────────────────
function InvitedBanner({ email, link, onDismiss }: { email: string; link: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-green-200 bg-green-50 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 size-5 shrink-0 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Invitación enviada a {email}
            </p>
            <p className="mt-1 text-xs text-green-700">
              Compartí el link si no recibe el email.
            </p>
            <button
              onClick={handleCopy}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-700 hover:underline"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? 'Copiado' : 'Copiar link de invitación'}
            </button>
          </div>
        </div>
        <button onClick={onDismiss} className="text-green-600 hover:text-green-800">
          <UserX className="size-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function CollaboratorsSection() {
  const { profile } = useAuth()

  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading]             = useState(true)
  const [loadError, setLoadError]         = useState<string | null>(null)
  const [showModal, setShowModal]         = useState(false)
  const [lastInvited, setLastInvited]     = useState<{ email: string; link: string } | null>(null)

  const loadCollaborators = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await listCollaborators()
      setCollaborators(res.data)
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (profile?.isOwner) loadCollaborators()
  }, [profile?.isOwner, loadCollaborators])

  const handleInvited = (collab: Collaborator, link: string) => {
    setCollaborators((prev) => [collab, ...prev])
    setShowModal(false)
    setLastInvited({ email: collab.email, link })
  }

  const handleRemoved = (id: string) =>
    setCollaborators((prev) => prev.filter((c) => c.id !== id))

  if (!profile?.isOwner) return null

  const active = collaborators.filter((c) => c.status !== 'REMOVED')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          <h2 className="font-medium text-foreground">
            Colaboradores {active.length > 0 && `(${active.length})`}
          </h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-3.5" />
          Invitar
        </button>
      </div>

      {/* Banner de invitación enviada */}
      <AnimatePresence>
        {lastInvited && (
          <InvitedBanner
            email={lastInvited.email}
            link={lastInvited.link}
            onDismiss={() => setLastInvited(null)}
          />
        )}
      </AnimatePresence>

      {/* Error de carga */}
      {loadError && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {loadError}
          <button onClick={loadCollaborators} className="ml-auto text-xs underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : active.length === 0 && !loadError ? (
        <EmptyState onInvite={() => setShowModal(true)} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {active.map((c) => (
              <CollaboratorRow key={c.id} collab={c} onRemove={handleRemoved} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de invitación */}
      <AnimatePresence>
        {showModal && (
          <InviteModal
            onClose={() => setShowModal(false)}
            onInvited={handleInvited}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
