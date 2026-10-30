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
import { Loader2, CircleAlert, ArrowLeft } from 'lucide-react'
import { Alert, Button, LoadingState, PageContainer, PageHeader, SectionHeader, Card } from '@real/ui'
import { useAuth }           from '@/context/auth-context'
import {
  useFeatureFlags,
  useUpdateFeatureFlag,
  useQuotas,
  useThemes,
  useActivateTheme,
} from '@/hooks/use-config'
import { WebhooksSection } from '@/components/config/webhooks-section'
import { SecretsSection }  from '@/components/config/secrets-section'
import { WhatsappSection } from '@/components/config/whatsapp-section'

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
  return <LoadingState className="p-6" />
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">{message}</Alert>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const router       = useRouter()
  const { activeOrganizationId: organizationId } = useAuth()

  // ── TanStack Query — datos de servidor ────────────────────────────────────
  const { data: flags,    isLoading: flagsLoading,    error: flagsError }    = useFeatureFlags()
  const { data: quotas,   isLoading: quotasLoading,   error: quotasError }   = useQuotas()
  const { data: themes,   isLoading: themesLoading,   error: themesError }   = useThemes()

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateFlag     = useUpdateFeatureFlag()
  const activateTheme  = useActivateTheme()

  if (!organizationId) {
    return <ErrorState message="No hay organización activa seleccionada." />
  }

  const isLoading = flagsLoading || quotasLoading || themesLoading
  const hasError  = flagsError || quotasError || themesError

  if (isLoading) return <LoadingSkeleton />
  if (hasError)  return <ErrorState message="Error al cargar la configuración. Intentá de nuevo." />

  return (
    <PageContainer size="md" className="space-y-8">
      <BackButton onClick={() => router.back()} />

      <PageHeader title="Configuración de organización" />

      {/* Feature Flags */}
      {flags && flags.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Feature flags" />
          {flags.map(flag => (
            <Card key={flag.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-sm">{flag.key}</p>
                {flag.description && (
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                )}
              </div>
              <Button
                variant={flag.enabled ? 'default' : 'outline'}
                size="sm"
                disabled={updateFlag.isPending || !flag.organizationId}
                onClick={() => updateFlag.mutate({ flagId: flag.id, enabled: !flag.enabled })}
              >
                {flag.enabled ? 'Activo' : 'Inactivo'}
              </Button>
            </Card>
          ))}
        </section>
      )}

      {/* Quotas — solo lectura */}
      {quotas && quotas.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Quotas" />
          {quotas.map(quota => (
            <Card key={quota.id} className="flex items-center justify-between p-4">
              <p className="font-medium text-sm">{quota.resource}</p>
              <span className="text-sm text-muted-foreground">
                {quota.currentUsage} / {quota.limit ?? '∞'}
              </span>
            </Card>
          ))}
        </section>
      )}

      {/* Temas */}
      {themes && themes.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Temas" />
          {themes.map(theme => (
            <Card key={theme.id} className="flex items-center justify-between p-4">
              <p className="font-medium text-sm">{theme.name}</p>
              <Button
                variant={theme.isActive ? 'default' : 'outline'}
                size="sm"
                disabled={activateTheme.isPending || theme.isActive}
                onClick={() => activateTheme.mutate({ themeId: theme.id })}
              >
                {theme.isActive ? 'Activo' : 'Activar'}
              </Button>
            </Card>
          ))}
        </section>
      )}

      {/* Webhooks y claves sensibles: piden confirmar la identidad al crear, rotar o borrar */}
      <WebhooksSection />
      <SecretsSection />

      {/* WhatsApp de la organización (ADR-025): Embedded Signup de Meta */}
      <WhatsappSection />
    </PageContainer>
  )
}
