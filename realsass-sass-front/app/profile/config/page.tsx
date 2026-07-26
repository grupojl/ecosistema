'use client'

// app/profile/config/page.tsx
//
// Configuración de la organización activa, servida por real-config-back.
// Accesible desde /profile -> botón "Configuración de la organización".
//
// organizationId:
//   - Si el usuario es OWNER, se usa profile.organization.id (role = 'OWNER').
//   - Si no, se usa la primera colaboración activa (role = tenant.role).
//
// Edición (PATCH) habilitada solo donde el backend lo permite:
//   - flags: cualquier miembro (OWNER o COLLABORATOR)
//   - quotas: solo OWNER
//   - themes (activar): cualquier miembro

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { getErrorMessage } from '@/lib/errors'
import { getCollaboratorTenants } from '@/lib/types'
import {
  getFeatureFlags, updateFeatureFlag,
  getQuotas, updateQuotaLimit,
  getThemes, activateTheme,
  getTemplates,
  getWebhooks,
  type FeatureFlag, type QuotaConfig, type ThemeConfig,
  type ContentTemplate, type WebhookEndpoint, type TenantRole,
} from '@/lib/config-api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

// ── Helpers ───────────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
      <ChevronLeft className="size-4" /> Volver
    </button>
  )
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-2">
      <p className="text-destructive">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5 mr-1.5" /> Reintentar
      </Button>
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
    </div>
  )
}

// ── Flags ─────────────────────────────────────────────────────────────────────

function FlagsTab({ organizationId }: { organizationId: string }) {
  const [flags, setFlags]   = useState<FeatureFlag[] | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    setFlags(null)
    getFeatureFlags(organizationId)
      .then(setFlags)
      .catch((e: unknown) => setError(getErrorMessage(e, 'No se pudieron cargar los flags')))
  }, [organizationId])

  useEffect(load, [load])

  const toggle = async (flag: FeatureFlag) => {
    setPending(flag.key)
    try {
      const updated = await updateFeatureFlag(organizationId, flag.key, !flag.enabled)
      setFlags(prev => prev?.map(f => f.key === flag.key ? updated : f) ?? null)
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo actualizar el flag'))
    } finally {
      setPending(null)
    }
  }

  if (error) return <SectionError message={error} onRetry={load} />
  if (!flags) return <SectionSkeleton />
  if (flags.length === 0) return <p className="text-sm text-muted-foreground">Sin feature flags configurados.</p>

  return (
    <div className="space-y-2">
      {flags.map(flag => (
        <div key={flag.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-foreground truncate">{flag.key}</p>
            {flag.description && <p className="text-xs text-muted-foreground truncate">{flag.description}</p>}
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-xs">{flag.systemTarget}</Badge>
              {flag.rolloutPercentage < 100 && (
                <Badge variant="secondary" className="text-xs">{flag.rolloutPercentage}% rollout</Badge>
              )}
            </div>
          </div>
          <Switch
            checked={flag.enabled}
            disabled={pending === flag.key}
            onCheckedChange={() => toggle(flag)}
          />
        </div>
      ))}
    </div>
  )
}

// ── Quotas ────────────────────────────────────────────────────────────────────

function QuotasTab({ organizationId, role }: { organizationId: string; role: TenantRole }) {
  const [quotas, setQuotas] = useState<QuotaConfig[] | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [edits, setEdits]   = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    setQuotas(null)
    getQuotas(organizationId)
      .then(setQuotas)
      .catch((e: unknown) => setError(getErrorMessage(e, 'No se pudieron cargar las quotas')))
  }, [organizationId])

  useEffect(load, [load])

  const save = async (resource: string) => {
    const raw = edits[resource]
    const limit = Number(raw)
    if (!raw || Number.isNaN(limit) || limit < 1) return

    setSaving(resource)
    try {
      const updated = await updateQuotaLimit(organizationId, resource, limit)
      setQuotas(prev => prev?.map(q => q.resource === resource ? updated : q) ?? null)
      setEdits(prev => ({ ...prev, [resource]: '' }))
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo actualizar la quota'))
    } finally {
      setSaving(null)
    }
  }

  if (error) return <SectionError message={error} onRetry={load} />
  if (!quotas) return <SectionSkeleton />
  if (quotas.length === 0) return <p className="text-sm text-muted-foreground">Sin quotas configuradas.</p>

  return (
    <div className="space-y-2">
      {quotas.map(q => {
        const pct = q.limit > 0 ? Math.min(100, Math.round((q.currentUsage / q.limit) * 100)) : 0
        return (
          <div key={q.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{q.resource}</p>
              <p className="text-xs text-muted-foreground">
                {q.currentUsage} / {q.limit === -1 ? '∞' : q.limit}
                {q.limit > 0 && ` (${pct}%)`}
              </p>
            </div>
            {role === 'OWNER' && (
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} placeholder={String(q.limit)}
                  value={edits[q.resource] ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [q.resource]: e.target.value }))}
                  className="h-8 max-w-[140px]"
                />
                <Button size="sm" disabled={saving === q.resource || !edits[q.resource]} onClick={() => save(q.resource)}>
                  {saving === q.resource ? <Loader2 className="size-3.5 animate-spin" /> : 'Guardar límite'}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tema ──────────────────────────────────────────────────────────────────────

function ThemeTab({ organizationId }: { organizationId: string }) {
  const [themes, setThemes] = useState<ThemeConfig[] | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    setThemes(null)
    getThemes(organizationId)
      .then(setThemes)
      .catch((e: unknown) => setError(getErrorMessage(e, 'No se pudieron cargar los temas')))
  }, [organizationId])

  useEffect(load, [load])

  const activate = async (id: string) => {
    setPending(id)
    try {
      await activateTheme(organizationId, id)
      load()
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo activar el tema'))
    } finally {
      setPending(null)
    }
  }

  if (error) return <SectionError message={error} onRetry={load} />
  if (!themes) return <SectionSkeleton />
  if (themes.length === 0) return <p className="text-sm text-muted-foreground">Sin temas configurados.</p>

  return (
    <div className="space-y-2">
      {themes.map(theme => (
        <div key={theme.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex gap-1 shrink-0">
              <span className="size-5 rounded-full border border-border" style={{ backgroundColor: theme.primaryColor }} />
              <span className="size-5 rounded-full border border-border" style={{ backgroundColor: theme.secondaryColor }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{theme.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {theme.isSystemDefault && <Badge variant="outline" className="text-xs">Sistema</Badge>}
                <span className="text-xs text-muted-foreground">{theme.fontFamily}</span>
              </div>
            </div>
          </div>
          {theme.isActive
            ? <Badge className="shrink-0">Activo</Badge>
            : (
              <Button size="sm" variant="outline" disabled={pending === theme.id} onClick={() => activate(theme.id)}>
                {pending === theme.id ? <Loader2 className="size-3.5 animate-spin" /> : 'Activar'}
              </Button>
            )}
        </div>
      ))}
    </div>
  )
}

// ── Plantillas ────────────────────────────────────────────────────────────────

function TemplatesTab({ organizationId }: { organizationId: string }) {
  const [templates, setTemplates] = useState<ContentTemplate[] | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    setTemplates(null)
    getTemplates(organizationId)
      .then(setTemplates)
      .catch((e: unknown) => setError(getErrorMessage(e, 'No se pudieron cargar las plantillas')))
  }, [organizationId])

  useEffect(load, [load])

  if (error) return <SectionError message={error} onRetry={load} />
  if (!templates) return <SectionSkeleton />
  if (templates.length === 0) return <p className="text-sm text-muted-foreground">Sin plantillas configuradas.</p>

  return (
    <div className="space-y-2">
      {templates.map(tpl => (
        <div key={tpl.id} className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{tpl.name}</p>
            <Badge variant="outline" className="text-xs">{tpl.category}</Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{tpl.key}</p>
          {tpl.variables.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tpl.variables.map(v => (
                <span key={v} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground/70 font-mono">{`{{${v}}}`}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

function WebhooksTab({ organizationId }: { organizationId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[] | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    setWebhooks(null)
    getWebhooks(organizationId)
      .then(setWebhooks)
      .catch((e: unknown) => setError(getErrorMessage(e, 'No se pudieron cargar los webhooks')))
  }, [organizationId])

  useEffect(load, [load])

  if (error) return <SectionError message={error} onRetry={load} />
  if (!webhooks) return <SectionSkeleton />
  if (webhooks.length === 0) return <p className="text-sm text-muted-foreground">Sin webhooks configurados.</p>

  return (
    <div className="space-y-2">
      {webhooks.map(wh => (
        <div key={wh.id} className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate font-mono">{wh.url}</p>
            <Badge variant={wh.isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
              {wh.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {wh.events.map(ev => <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>)}
          </div>
          {wh.failureCount > 0 && (
            <p className="text-xs text-destructive">{wh.failureCount} entregas fallidas</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizationConfigPage() {
  const router = useRouter()
  const { firebaseUser, profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/')
  }, [loading, firebaseUser, router])

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <SectionSkeleton />
        </div>
      </div>
    )
  }

  const collaborations = getCollaboratorTenants(profile)
  const organizationId = profile.organization?.id ?? collaborations[0]?.organizationId
  const role: TenantRole = profile.organization?.id
    ? 'OWNER'
    : (collaborations[0]?.role ?? 'COLLABORATOR')

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <BackButton onClick={() => router.push('/profile')} />
          <p className="text-sm text-muted-foreground">No tenés una organización activa.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-5">
        <BackButton onClick={() => router.push('/profile')} />

        <div>
          <h1 className="font-serif text-xl text-foreground">Configuración de la organización</h1>
          <p className="text-sm text-muted-foreground">{profile.organization?.name ?? 'Tu organización'}</p>
        </div>

        <Tabs defaultValue="flags">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="flags">Flags</TabsTrigger>
            <TabsTrigger value="quotas">Quotas</TabsTrigger>
            <TabsTrigger value="theme">Tema</TabsTrigger>
            <TabsTrigger value="templates">Plantillas</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="flags" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Feature flags</CardTitle>
                <CardDescription>Funcionalidades habilitadas para esta organización.</CardDescription>
              </CardHeader>
              <CardContent><FlagsTab organizationId={organizationId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotas" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Límites de uso</CardTitle>
                <CardDescription>
                  {role === 'OWNER' ? 'Podés editar los límites de tu plan.' : 'Solo el owner puede editar los límites.'}
                </CardDescription>
              </CardHeader>
              <CardContent><QuotasTab organizationId={organizationId} role={role} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="theme" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tema visual</CardTitle>
                <CardDescription>Branding aplicado a las páginas públicas de la organización.</CardDescription>
              </CardHeader>
              <CardContent><ThemeTab organizationId={organizationId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Plantillas de contenido</CardTitle>
                <CardDescription>Textos reutilizables para emails, chat y notificaciones.</CardDescription>
              </CardHeader>
              <CardContent><TemplatesTab organizationId={organizationId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webhooks</CardTitle>
                <CardDescription>Integraciones salientes configuradas para esta organización.</CardDescription>
              </CardHeader>
              <CardContent><WebhooksTab organizationId={organizationId} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
