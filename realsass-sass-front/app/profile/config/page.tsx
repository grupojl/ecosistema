'use client'
/**
 * app/profile/config/page.tsx — realsass-sass-front
 *
 * Configuración de la organización activa.
 * Migrado de useEffect/useState manual → TanStack Query vía hooks de use-config.ts
 *
 * Capa 2 completa: datos de servidor en TanStack Query con:
 *   - estados loading/error/data explícitos
 *   - cache con staleTime configurado en cada hook
 *   - invalidación automática en mutations
 */
import { useRouter }         from 'next/navigation'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button }            from '@real/ui'
import { useAuth }           from '@/context/auth-context'
import {
  useFeatureFlags,
  useUpdateFeatureFlag,
  useQuotas,
  useThemes,
  useActivateTheme,
  useWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
} from '@/hooks/use-config'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="mb-4">
      <ArrowLeft className="h-4 w-4 mr-2" />
      Volver
    </Button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 rounded-lg bg-muted" />
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-4 rounded-lg border border-destructive/20 bg-destructive/5">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const router       = useRouter()
  const { profile }  = useAuth()

  const organizationId = profile?.organization?.id ?? null

  // ── TanStack Query — datos de servidor ────────────────────────────────────
  const { data: flags,    isLoading: flagsLoading,    error: flagsError }    = useFeatureFlags()
  const { data: quotas,   isLoading: quotasLoading,   error: quotasError }   = useQuotas()
  const { data: themes,   isLoading: themesLoading,   error: themesError }   = useThemes()
  const { data: webhooks, isLoading: webhooksLoading, error: webhooksError } = useWebhooks()

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateFlag     = useUpdateFeatureFlag()
  const activateTheme  = useActivateTheme()
  const createWebhook  = useCreateWebhook()
  const deleteWebhook  = useDeleteWebhook()

  if (!organizationId) {
    return <ErrorState message="No hay organización activa seleccionada." />
  }

  const isLoading = flagsLoading || quotasLoading || themesLoading || webhooksLoading
  const hasError  = flagsError || quotasError || themesError || webhooksError

  if (isLoading) return <LoadingSkeleton />
  if (hasError)  return <ErrorState message="Error al cargar la configuración. Intentá de nuevo." />

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <BackButton onClick={() => router.back()} />

      <h1 className="text-2xl font-semibold">Configuración de organización</h1>

      {/* Feature Flags */}
      {flags && flags.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Feature flags</h2>
          {flags.map(flag => (
            <div key={flag.id} className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{flag.key}</p>
                {flag.description && (
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                )}
              </div>
              <Button
                variant={flag.value ? 'default' : 'outline'}
                size="sm"
                disabled={updateFlag.isPending || !flag.organizationId}
                onClick={() => updateFlag.mutate({ flagId: flag.id, value: !flag.value })}
              >
                {flag.value ? 'Activo' : 'Inactivo'}
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* Quotas — solo lectura */}
      {quotas && quotas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Quotas</h2>
          {quotas.map(quota => (
            <div key={quota.id} className="flex items-center justify-between p-4 rounded-lg border">
              <p className="font-medium text-sm">{quota.resource}</p>
              <span className="text-sm text-muted-foreground">
                {quota.currentUsage} / {quota.limit ?? '∞'}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Temas */}
      {themes && themes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Temas</h2>
          {themes.map(theme => (
            <div key={theme.id} className="flex items-center justify-between p-4 rounded-lg border">
              <p className="font-medium text-sm">{theme.name}</p>
              <Button
                variant={theme.isActive ? 'default' : 'outline'}
                size="sm"
                disabled={activateTheme.isPending || theme.isActive}
                onClick={() => activateTheme.mutate({ themeId: theme.id })}
              >
                {theme.isActive ? 'Activo' : 'Activar'}
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* Webhooks */}
      {webhooks && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Webhooks</h2>
            <Button
              size="sm"
              disabled={createWebhook.isPending}
              onClick={() => createWebhook.mutate({ url: '', events: [] })}
            >
              Agregar
            </Button>
          </div>
          {webhooks.map(wh => (
            <div key={wh.id} className="flex items-center justify-between p-4 rounded-lg border">
              <p className="text-sm font-mono truncate max-w-xs">{wh.url}</p>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteWebhook.isPending}
                onClick={() => deleteWebhook.mutate({ webhookId: wh.id })}
              >
                Eliminar
              </Button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
