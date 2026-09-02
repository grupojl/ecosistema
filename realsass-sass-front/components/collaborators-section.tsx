'use client'
/**
 * collaborators-section.tsx — realsass-sass-front
 *
 * Gestión de colaboradores del dashboard de owner.
 * Migrado de lib/api fetch manual → hooks tRPC (use-collaborators.ts)
 */
import { useState }        from 'react'
import { Users, Plus, Trash2, Copy, Check, Loader2, AlertCircle, Mail } from 'lucide-react'
import { Button, Input, Badge, Skeleton, Switch, Label } from '@real/ui'
import { useAuth }         from '@/context/auth-context'
import {
  useCollaborators,
  useInviteCollaborator,
  useRemoveCollaborator,
  useUpdateCollaboratorPermissions,
} from '@/hooks/use-collaborators'
import { getErrorMessage } from '@/lib/errors'

// ── Estado vacío ──────────────────────────────────────────────────────────────
function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <Users className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No tenés colaboradores todavía</p>
      <Button size="sm" onClick={onInvite}>
        <Plus className="h-4 w-4 mr-2" /> Invitar colaborador
      </Button>
    </div>
  )
}

// ── Fila de colaborador ───────────────────────────────────────────────────────
function CollaboratorRow({
  collab,
  onRemove,
}: {
  collab:   { id: string; email: string; status: string; inviteLink?: string }
  onRemove: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const remove = useRemoveCollaborator()

  const handleCopy = () => {
    if (collab.inviteLink) {
      navigator.clipboard.writeText(collab.inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRemove = async () => {
    await remove.mutateAsync({ collaboratorId: collab.id })
    onRemove(collab.id)
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{collab.email}</p>
          <Badge variant={collab.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
            {collab.status === 'ACTIVE' ? 'Activo' : 'Pendiente'}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {collab.status === 'PENDING' && collab.inviteLink && (
          <Button variant="ghost" size="icon" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="ghost" size="icon"
          disabled={remove.isPending}
          onClick={handleRemove}
        >
          {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
        </Button>
      </div>
    </div>
  )
}

// ── Modal de invitación ───────────────────────────────────────────────────────
function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const invite = useInviteCollaborator()

  const handleSubmit = async () => {
    if (!email.trim()) return
    await invite.mutateAsync({ email: email.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-semibold">Invitar colaborador</h3>
        <Input
          type="email"
          placeholder="email@ejemplo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        {invite.error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {getErrorMessage(invite.error)}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={invite.isPending || !email.trim()} onClick={handleSubmit}>
            {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar invitación
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function CollaboratorsSection() {
  const [showInvite, setShowInvite] = useState(false)
  const { data, isLoading, error }  = useCollaborators()

  if (isLoading) return (
    <div className="space-y-2">
      {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-2 text-destructive p-4 rounded-lg border border-destructive/20">
      <AlertCircle className="h-4 w-4" />
      <p className="text-sm">{getErrorMessage(error)}</p>
    </div>
  )

  const collaborators = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Colaboradores
        </h3>
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <Plus className="h-4 w-4 mr-2" /> Invitar
        </Button>
      </div>

      {collaborators.length === 0
        ? <EmptyState onInvite={() => setShowInvite(true)} />
        : (
          <div className="space-y-2">
            {collaborators.map(c => (
              <CollaboratorRow
                key={c.id}
                collab={c as any}
                onRemove={() => {}}
              />
            ))}
          </div>
        )
      }

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}
