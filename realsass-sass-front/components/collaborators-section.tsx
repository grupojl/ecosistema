'use client'
/**
 * collaborators-section.tsx — realsass-sass-front
 *
 * Gestión de colaboradores del dashboard de owner.
 * Migrado de lib/api fetch manual → hooks tRPC (use-collaborators.ts)
 */
import { useState }        from 'react'
import { Users, Plus, Trash2, Copy, Check, Loader2, CircleAlert, Mail } from 'lucide-react'
import { Button, Input, Badge, Skeleton, Switch, Label, SectionHeader,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Card, EmptyState } from '@real/ui'
import { useAuth }         from '@/context/auth-context'
import {
  useCollaborators,
  useInviteCollaborator,
  useRemoveCollaborator,
  useUpdateCollaboratorPermissions,
} from '@/hooks/use-collaborators'
import { getErrorMessage } from '@/lib/errors'

// ── Estado vacío ──────────────────────────────────────────────────────────────

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
    <Card className="flex items-center justify-between p-3">
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
            {copied ? <Check className="h-4 w-4 text-success-ink" /> : <Copy className="h-4 w-4" />}
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
    </Card>
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
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent preset="form">
        <DialogHeader>
          <DialogTitle>Invitar colaborador</DialogTitle>
          <DialogDescription>Le enviamos un correo con el enlace para unirse a tu organización.</DialogDescription>
        </DialogHeader>
        <Input
          type="email"
          placeholder="email@ejemplo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        {invite.error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <CircleAlert className="h-4 w-4" />
            {getErrorMessage(invite.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={invite.isPending || !email.trim()} onClick={handleSubmit}>
            {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enviar invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <EmptyState kind="error" description={getErrorMessage(error)} />
  )

  const collaborators = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader size="sm" icon={<Users />} title="Colaboradores" />
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <Plus className="h-4 w-4 mr-2" /> Invitar
        </Button>
      </div>

      {collaborators.length === 0
        ? <EmptyState
            icon={<Users />}
            title="Sin colaboradores"
            description="No tenés colaboradores todavía"
            action={<Button size="sm" onClick={() => setShowInvite(true)}><Plus className="h-4 w-4 mr-2" /> Invitar colaborador</Button>}
          />
        : (
          <div className="space-y-2">
            {collaborators.map(c => (
              <CollaboratorRow
                key={c.id}
                collab={c}
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
