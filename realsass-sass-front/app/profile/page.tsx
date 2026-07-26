'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Users, Check, Loader2, LogOut,
  ArrowRight, Copy, AlertCircle, ChevronLeft,
  Star, Plus, Shield, Eye, Mail, Trash2,
  ChevronDown, ChevronUp, Link as LinkIcon,
  Pencil, X, LayoutGrid, Settings,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import {
  selectRole, updateMyOrganization,
  listCollaborators, inviteCollaborator,
  updateCollaboratorPermissions, removeCollaborator,
} from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { getCollaboratorTenants } from '@/lib/types'
import { useDashboardSSO } from '@/hooks/use-dashboard-sso'
import type { Organization, Tenant, Collaborator, CollaboratorPermissions } from '@/lib/types'

type View = 'overview' | 'add-role' | 'edit-org' | 'collaborators'

// ── Helpers ───────────────────────────────────────────────────────────────────
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
      <ChevronLeft className="size-4" /> Volver
    </button>
  )
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-mono font-medium text-foreground hover:bg-primary/5 transition-all">
      <span>{code}</span>
      {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4 text-muted-foreground" />}
    </button>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-all">
      {copied ? <><Check className="size-3 text-primary" /> Copiado</> : <><Copy className="size-3" /> {label}</>}
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 animate-pulse">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-muted shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-56 rounded bg-muted" />
          </div>
        </div>
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted" />)}
      </div>
    </div>
  )
}

// ── Permisos ──────────────────────────────────────────────────────────────────
const PERM_LABELS: Record<keyof CollaboratorPermissions, string> = {
  canViewListings:        'Ver propiedades',
  canCreateListings:      'Crear propiedades',
  canEditListings:        'Editar propiedades',
  canDeleteListings:      'Eliminar propiedades',
  canViewStats:           'Ver estadísticas',
  canManageLeads:         'Gestionar clientes',
  canManageCollaborators: 'Gestionar colaboradores',
}
const PERM_KEYS = Object.keys(PERM_LABELS) as (keyof CollaboratorPermissions)[]

// ── InviteForm ────────────────────────────────────────────────────────────────
function InviteForm({ onInvited }: { onInvited: (link: string) => void }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [perms, setPerms] = useState<CollaboratorPermissions>({
    canViewListings:        true,
    canCreateListings:      false,
    canEditListings:        false,
    canDeleteListings:      false,
    canViewStats:           false,
    canManageLeads:         false,
    canManageCollaborators: false,
  })
  const [showPerms, setShowPerms] = useState(false)

  const handleInvite = async () => {
    if (!email.trim()) { setError('Ingresá un email'); return }
    setLoading(true); setError(null)
    try {
      const res = await inviteCollaborator({ email: email.trim(), ...perms })
      onInvited(res.data.inviteLink)
    } catch (e: any) {
      setError(e.message ?? 'Error al enviar invitación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Invitar colaborador</h3>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleInvite()}
          placeholder="colaborador@email.com"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" />
      </div>
      <button onClick={() => setShowPerms(p => !p)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        {showPerms ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        Configurar permisos
      </button>
      {showPerms && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PERM_KEYS.map(key => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setPerms(p => ({ ...p, [key]: !p[key] }))}
                className={`relative flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${perms[key] ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${perms[key] ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
              <span className="text-xs text-foreground">{PERM_LABELS[key]}</span>
            </label>
          ))}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" /> {error}
        </div>
      )}
      <button onClick={handleInvite} disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all">
        {loading ? <><Loader2 className="size-4 animate-spin" /> Enviando...</> : <><Mail className="size-4" /> Generar invitación</>}
      </button>
    </div>
  )
}

// ── CollaboratorRow ───────────────────────────────────────────────────────────
function CollaboratorRow({ collab, onRemoved, onUpdated }: {
  collab:    Collaborator
  onRemoved: (id: string) => void
  onUpdated: (id: string, perms: Partial<CollaboratorPermissions>) => void
}) {
  const [expanded,   setExpanded]   = useState(false)
  const [removing,   setRemoving]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [localPerms, setLocalPerms] = useState<CollaboratorPermissions>({
    canViewListings:        collab.canViewListings,
    canCreateListings:      collab.canCreateListings,
    canEditListings:        collab.canEditListings,
    canDeleteListings:      collab.canDeleteListings,
    canViewStats:           collab.canViewStats,
    canManageLeads:         collab.canManageLeads,
    canManageCollaborators: collab.canManageCollaborators,
  })

  const statusColors: Record<string, string> = {
    ACTIVE:  'bg-emerald-100 text-emerald-700',
    PENDING: 'bg-amber-100 text-amber-700',
    REMOVED: 'bg-muted text-muted-foreground',
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await removeCollaborator(collab.id)
      onRemoved(collab.id)
    } catch { setRemoving(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateCollaboratorPermissions(collab.id, localPerms)
      onUpdated(collab.id, localPerms)
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <span className="text-xs font-medium text-primary">{(collab.email ?? 'U').charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{collab.email}</p>
            <span className={`inline-flex text-xs px-1.5 py-0.5 rounded-full ${statusColors[collab.status] ?? ''}`}>{collab.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setExpanded(p => !p)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </button>
          <button onClick={handleRemove} disabled={removing} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
            {removing ? <Loader2 className="size-4 animate-spin text-destructive" /> : <Trash2 className="size-4 text-destructive" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PERM_KEYS.map(key => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setLocalPerms(p => ({ ...p, [key]: !p[key] }))}
                  className={`relative flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${localPerms[key] ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${localPerms[key] ? 'translate-x-4' : 'translate-x-1'}`} />
                </div>
                <span className="text-xs text-foreground">{PERM_LABELS[key]}</span>
              </label>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all">
            {saving ? <><Loader2 className="size-3.5 animate-spin" /> Guardando...</> : <><Check className="size-3.5" /> Guardar permisos</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ── CollaboratorsView ─────────────────────────────────────────────────────────
function CollaboratorsView({ onBack }: { onBack: () => void }) {
  const [collabs,    setCollabs]    = useState<Collaborator[]>([])
  const [loading,    setLoading]    = useState(true)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCollaborators()
      setCollabs(res.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Colaboradores</h2>
      </div>
      <InviteForm onInvited={link => { setInviteLink(link); load() }} />
      {inviteLink && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-medium text-primary flex items-center gap-1.5"><LinkIcon className="size-3.5" /> Link de invitación generado</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background rounded-lg px-3 py-2 border border-border truncate">{inviteLink}</code>
            <CopyButton text={inviteLink} label="Copiar" />
          </div>
        </div>
      )}
      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : collabs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Users className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tenés colaboradores todavía</p>
        </div>
      ) : (
        <div className="space-y-2">
          {collabs.map(c => (
            <CollaboratorRow key={c.id} collab={c}
              onRemoved={id => setCollabs(prev => prev.filter(x => x.id !== id))}
              onUpdated={(id, perms) => setCollabs(prev => prev.map(x => x.id === id ? { ...x, ...perms } : x))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── RoleSelector ──────────────────────────────────────────────────────────────
function RoleSelector({ currentIsOwner, currentIsAffiliate, onSelected, onBack }: {
  currentIsOwner: boolean; currentIsAffiliate: boolean; onSelected: () => void; onBack: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSelect = async (role: 'owner' | 'affiliate') => {
    setLoading(true); setError(null)
    try {
      await selectRole(role)
      onSelected()
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <h2 className="text-lg font-semibold text-foreground">Elegí tu rol</h2>
      {!currentIsOwner && (
        <button onClick={() => handleSelect('owner')} disabled={loading}
          className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-60">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 shrink-0"><Building2 className="size-5 text-amber-600" /></div>
          <div>
            <p className="font-medium text-foreground">Owner</p>
            <p className="text-xs text-muted-foreground mt-0.5">Creá y gestioná tu propia organización</p>
          </div>
          {loading ? <Loader2 className="size-4 animate-spin ml-auto" /> : <ArrowRight className="size-4 text-muted-foreground ml-auto" />}
        </button>
      )}
      {!currentIsAffiliate && (
        <button onClick={() => handleSelect('affiliate')} disabled={loading}
          className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-60">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 shrink-0"><Star className="size-5 text-emerald-600" /></div>
          <div>
            <p className="font-medium text-foreground">Afiliado</p>
            <p className="text-xs text-muted-foreground mt-0.5">Referí usuarios y ganá comisiones</p>
          </div>
          {loading ? <Loader2 className="size-4 animate-spin ml-auto" /> : <ArrowRight className="size-4 text-muted-foreground ml-auto" />}
        </button>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </div>
      )}
    </div>
  )
}

// ── OrgForm ───────────────────────────────────────────────────────────────────
function OrgForm({ org, onBack, onSaved }: { org: Organization | null; onBack: () => void; onSaved: () => void }) {
  const [form,    setForm]    = useState({
    name:        org?.name        ?? '',
    description: org?.description ?? '',
    website:     org?.website     ?? '',
    phone:       org?.phone       ?? '',
    address:     org?.address     ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSave = async () => {
    setLoading(true); setError(null)
    try {
      await updateMyOrganization(form)
      onSaved()
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <div className="flex items-center gap-2"><Pencil className="size-4 text-primary" /><h2 className="text-lg font-semibold">Mi organización</h2></div>
      <div className="space-y-3">
        {([
          { key: 'name',        label: 'Nombre',      placeholder: 'Inmobiliaria XYZ' },
          { key: 'description', label: 'Descripción', placeholder: 'Breve descripción' },
          { key: 'website',     label: 'Sitio web',   placeholder: 'https://...' },
          { key: 'phone',       label: 'Teléfono',    placeholder: '+54 11 ...' },
          { key: 'address',     label: 'Dirección',   placeholder: 'Calle 123, Ciudad' },
        ] as const).map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-muted-foreground">{label}</label>
            <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" />
          </div>
        ))}
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all">
        {loading ? <><Loader2 className="size-4 animate-spin" /> Guardando...</> : <><Check className="size-4" /> Guardar cambios</>}
      </button>
    </div>
  )
}

// ── TenantCard ────────────────────────────────────────────────────────────────
function TenantCard({ tenant }: { tenant: Tenant }) {
  const org = tenant.organization
  const activePerms = Object.entries(tenant.permissions).filter(([, v]) => v).map(([k]) => PERM_LABELS[k as keyof CollaboratorPermissions]).filter(Boolean)
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start gap-3">
        {org.logoUrl
          ? <img src={org.logoUrl} alt={org.name ?? ''} className="size-10 rounded-xl border border-border object-cover shrink-0" />
          : <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 shrink-0"><Building2 className="size-5 text-primary" /></div>}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{org.name ?? 'Sin nombre'}</p>
          <div className="flex items-center gap-1 mt-0.5"><Shield className="size-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">Colaborador</span></div>
        </div>
      </div>
      {activePerms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activePerms.map(p => <span key={p} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground/70"><Eye className="size-2.5" /> {p}</span>)}
        </div>
      )}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ onAddRole, onEditOrg, onCollaborators }: {
  onAddRole: () => void; onEditOrg: () => void; onCollaborators: () => void
}) {
  const { profile, firebaseUser, logout } = useAuth()
  const router = useRouter()
  if (!profile || !firebaseUser) return null

  const displayName    = profile.displayName ?? firebaseUser.displayName ?? profile.email
  const initials       = (displayName ?? 'U').charAt(0).toUpperCase()
  const noRole         = !profile.isOwner && !profile.isAffiliate
  const canAddRole     = !profile.isOwner || !profile.isAffiliate
  const collaborations = getCollaboratorTenants(profile)

  const { state: ssoState, ssoError, openDashboard } = useDashboardSSO(
    () => firebaseUser?.getIdToken() ?? Promise.resolve(null),
  )
  const canAccessDashboard = profile.isOwner || collaborations.length > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        {profile.avatarUrl
          ? <img src={profile.avatarUrl} alt={displayName ?? ''} className="size-16 rounded-full object-cover border-2 border-border shrink-0" />
          : <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-semibold shrink-0">{initials}</div>}
        <div className="min-w-0">
          <h1 className="font-serif text-xl text-foreground truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {profile.isOwner     && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"><Building2 className="size-3" /> Owner</span>}
            {profile.isAffiliate && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"><Star className="size-3" /> Afiliado</span>}
            {collaborations.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"><Shield className="size-3" /> {collaborations.length} colaboración{collaborations.length > 1 ? 'es' : ''}</span>}
          </div>
        </div>
      </div>

      {noRole && (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">¿Cómo querés usar la plataforma?</p>
          <p className="text-xs text-muted-foreground">Elegí tu rol para empezar</p>
          <button onClick={onAddRole} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"><Plus className="size-4" /> Elegir rol</button>
        </div>
      )}

      {/* Org propia */}
      {profile.isOwner && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Building2 className="size-4 text-primary" /><h2 className="text-sm font-medium text-foreground">Mi organización</h2></div>
            <button onClick={onEditOrg} className="text-xs text-primary hover:underline">{profile.organization?.name ? 'Editar' : 'Completar'}</button>
          </div>
          {profile.organization?.name ? (
            <div className="space-y-1.5 text-sm">
              {[
                { label: 'Nombre',      value: profile.organization.name        },
                { label: 'Descripción', value: profile.organization.description },
                { label: 'Sitio web',   value: profile.organization.website     },
                { label: 'Teléfono',    value: profile.organization.phone       },
                { label: 'Dirección',   value: profile.organization.address     },
              ].filter(({ value }) => value).map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="font-medium text-foreground text-right truncate">{value}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground italic">Completá los datos de tu inmobiliaria</p>}
          <button onClick={() => router.push('/profile/config')}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-all">
            <div className="flex items-center gap-2"><Settings className="size-4 text-primary" /> Configuración de la organización</div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </button>
          <button onClick={onCollaborators}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-all">
            <div className="flex items-center gap-2"><Users className="size-4 text-primary" /> Gestionar colaboradores</div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Colaboraciones */}
      {collaborations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">Organizaciones donde colaborás</p>
          {collaborations.map(t => <TenantCard key={t.organizationId} tenant={t} />)}
        </div>
      )}

      {/* Panel afiliado */}
      {profile.isAffiliate && profile.affiliateCode && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2"><Users className="size-4 text-emerald-600" /><h2 className="text-sm font-medium text-foreground">Panel de afiliado</h2></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Referidos</p><p className="text-xl font-semibold text-foreground mt-0.5">{profile.affiliateData?.referralCount ?? 0}</p></div>
            <div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Balance</p><p className="text-xl font-semibold text-foreground mt-0.5">${profile.affiliateData?.balance ?? '0.00'}</p></div>
          </div>
          <div><p className="text-xs text-muted-foreground mb-2">Tu código de referido</p><CopyCode code={profile.affiliateCode} /></div>
        </div>
      )}

      {canAddRole && !noRole && (
        <button onClick={onAddRole} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
          <Plus className="size-4" />{!profile.isOwner ? 'Activar rol Owner' : 'Activar rol Afiliado'}
        </button>
      )}

      {/* Botón SSO — solo para owners y colaboradores */}
      {canAccessDashboard && (
        <button
          onClick={openDashboard}
          disabled={ssoState === 'loading' || ssoState === 'success'}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all"
        >
          {ssoState === 'loading' && (
            <><Loader2 className="size-4 animate-spin" /> Conectando...</>
          )}
          {ssoState === 'success' && (
            <><Check className="size-4" /> Redirigiendo...</>
          )}
          {(ssoState === 'idle' || ssoState === 'error') && (
            <><LayoutGrid className="size-4" /> Ir al Dashboard</>
          )}
        </button>
      )}

      {ssoState === 'error' && ssoError && (
        <p className="text-center text-xs text-destructive">{ssoError}</p>
      )}

      <button onClick={async () => { await logout(); router.push('/') }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-3 text-sm text-destructive hover:bg-destructive/5 transition-all">
        <LogOut className="size-4" /> Cerrar sesión
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter()
  const { firebaseUser, profile, loading, busy } = useAuth()
  const [view, setView] = useState<View>('overview')

  useEffect(() => {
    if (!loading && !busy && !firebaseUser) router.push('/')
  }, [loading, busy, firebaseUser, router])

  if (loading || busy) return <ProfileSkeleton />
  if (!firebaseUser || !profile) return <ProfileSkeleton />

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
            {view === 'overview'      && <Overview onAddRole={() => setView('add-role')} onEditOrg={() => setView('edit-org')} onCollaborators={() => setView('collaborators')} />}
            {view === 'add-role'      && <RoleSelector currentIsOwner={profile.isOwner} currentIsAffiliate={profile.isAffiliate} onSelected={() => setView('overview')} onBack={() => setView('overview')} />}
            {view === 'edit-org'      && <OrgForm org={profile.organization ?? null} onBack={() => setView('overview')} onSaved={() => setView('overview')} />}
            {view === 'collaborators' && <CollaboratorsView onBack={() => setView('overview')} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
