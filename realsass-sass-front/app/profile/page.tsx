'use client'
/**
 * app/profile/page.tsx — realsass-sass-front
 *
 * Dashboard del owner: organización propia, colaboraciones y afiliado.
 * Migrado de lib/api fetch manual → hooks tRPC (ADR-006).
 *
 * Vistas:
 *   overview      — org propia + colaboraciones + panel afiliado
 *   add-role      — selección de rol (owner / affiliate)
 *   edit-org      — editar nombre/descripción/logo de la org
 *   collaborators — gestión de colaboradores (delegado a CollaboratorsSection)
 */
import { useState }          from 'react'
import { useRouter }         from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Users, Check, Loader2, LogOut, ArrowRight,
  Copy, AlertCircle, ChevronLeft, Star, Settings, Link as LinkIcon,
} from 'lucide-react'
import {
  Button, Input, Badge, Skeleton, Avatar, AvatarFallback, AvatarImage,
} from '@real/ui'
import { useAuth }                 from '@/context/auth-context'
import { useMe, useSelectRole, useRefreshClaims } from '@/hooks/use-auth-trpc'
import { trpc }                    from '@/lib/trpc/client'
import { CollaboratorsSection }    from '@/components/collaborators-section'
import { useDashboardSSO }         from '@/hooks/use-dashboard-sso'
import { getErrorMessage }         from '@/lib/errors'

type View = 'overview' | 'add-role' | 'edit-org' | 'collaborators'

// ── Helpers ───────────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
      <ChevronLeft className="h-4 w-4" /> Volver
    </button>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 rounded-xl bg-muted" />
      <div className="h-16 rounded-xl bg-muted" />
      <div className="h-16 rounded-xl bg-muted" />
    </div>
  )
}

// ── RoleSelector ──────────────────────────────────────────────────────────────

function RoleSelector({ onBack }: { onBack: () => void }) {
  const selectRole     = useSelectRole()
  const refreshClaims  = useRefreshClaims()

  const handleSelect = async (role: 'owner' | 'affiliate') => {
    await selectRole.mutateAsync({ role })
    await refreshClaims.mutateAsync()
    onBack()
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <h2 className="font-semibold text-lg">Seleccioná tu rol</h2>
      {(['owner', 'affiliate'] as const).map(role => (
        <button
          key={role}
          disabled={selectRole.isPending}
          onClick={() => handleSelect(role)}
          className="flex w-full items-center justify-between p-4 rounded-xl border hover:bg-accent transition"
        >
          <div className="flex items-center gap-3">
            {role === 'owner' ? <Building2 className="h-5 w-5" /> : <Star className="h-5 w-5" />}
            <div className="text-left">
              <p className="font-medium capitalize">{role}</p>
              <p className="text-xs text-muted-foreground">
                {role === 'owner' ? 'Gestioná tu organización' : 'Referí y ganás comisiones'}
              </p>
            </div>
          </div>
          {selectRole.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      ))}
    </div>
  )
}

// ── OrgForm ───────────────────────────────────────────────────────────────────

function OrgForm({ onBack }: { onBack: () => void }) {
  const { data: me }      = useMe()
  const updateOrg         = trpc.organizations.update.useMutation({
    onSuccess: () => onBack(),
  })

  const org = (me as any)?.organization
  const [name, setName]   = useState(org?.name ?? '')
  const [desc, setDesc]   = useState(org?.description ?? '')

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <h2 className="font-semibold text-lg">Editar organización</h2>
      <div className="space-y-3">
        <Input
          placeholder="Nombre de la organización"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Input
          placeholder="Descripción"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
      </div>
      {updateOrg.error && (
        <p className="text-sm text-destructive">{getErrorMessage(updateOrg.error)}</p>
      )}
      <Button
        className="w-full"
        disabled={updateOrg.isPending}
        onClick={() => updateOrg.mutate({ name, description: desc })}
      >
        {updateOrg.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
        Guardar cambios
      </Button>
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({ onView }: { onView: (v: View) => void }) {
  const { logout }           = useAuth()
  const { data: me, isLoading, error } = useMe()
  const { triggerSSO, loading: ssoLoading } = useDashboardSSO()
  const [copied, setCopied]  = useState(false)

  if (isLoading) return <ProfileSkeleton />
  if (error) return (
    <div className="flex items-center gap-2 text-destructive p-4 rounded-xl border border-destructive/20">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <p className="text-sm">{getErrorMessage(error)}</p>
    </div>
  )

  const profile        = me as any
  const org            = profile?.organization
  const collaborations = profile?.collaborations ?? []
  const user           = profile?.user

  const referralCode   = user?.referralCode
  const referralLink   = referralCode ? `${window.location.origin}/?ref=${referralCode}` : null

  const handleCopyReferral = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">

      {/* Avatar + info usuario */}
      <div className="flex items-center gap-3 p-4 rounded-xl border">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user?.photoUrl ?? undefined} />
          <AvatarFallback>{(user?.displayName ?? 'U')[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{user?.displayName ?? 'Usuario'}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Org propia */}
      {org && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Mi organización</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onView('edit-org')}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm truncate">{org.name ?? org.slug ?? 'Sin nombre'}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onView('collaborators')}>
              <Users className="h-4 w-4 mr-2" /> Colaboradores
            </Button>
            {triggerSSO && (
              <Button size="sm" className="flex-1" disabled={ssoLoading} onClick={triggerSSO}>
                {ssoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Dashboard
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Colaboraciones */}
      {collaborations.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Mis colaboraciones
          </p>
          {collaborations.map((c: any) => (
            <div key={c.organizationId} className="flex items-center justify-between text-sm py-1">
              <span className="truncate text-muted-foreground">{c.organizationId}</span>
              <Badge variant="secondary">Colaborador</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Sin org — seleccionar rol */}
      {!org && (
        <button
          onClick={() => onView('add-role')}
          className="flex w-full items-center justify-between p-4 rounded-xl border hover:bg-accent transition"
        >
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Elegir mi rol</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Panel afiliado */}
      {referralLink && (
        <div className="rounded-xl border p-4 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground" /> Mi link de referido
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground truncate flex-1">{referralLink}</p>
            <Button size="sm" variant="outline" onClick={handleCopyReferral}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [view, setView] = useState<View>('overview')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-4 pt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0  }}
            exit={{    opacity: 0, x: -16 }}
            transition={{ duration: 0.15 }}
          >
            {view === 'overview'      && <Overview         onView={setView} />}
            {view === 'add-role'      && <RoleSelector     onBack={() => setView('overview')} />}
            {view === 'edit-org'      && <OrgForm          onBack={() => setView('overview')} />}
            {view === 'collaborators' && (
              <div className="space-y-4">
                <BackButton onClick={() => setView('overview')} />
                <CollaboratorsSection />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
