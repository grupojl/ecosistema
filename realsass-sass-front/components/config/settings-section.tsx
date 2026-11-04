'use client'
/**
 * settings-section.tsx — configuración general de la organización y de su storefront público.
 *
 * Los formularios son los de @real/ui (los mismos que usa el dashboard). El servidor decide si el usuario puede
 * modificar (`canEdit`: solo el dueño); un colaborador los ve en solo lectura.
 */
import { useState } from 'react'
import { Alert, Button, EmptyState, GeneralSettingsForm, SectionHeader, Skeleton, StorefrontSettingsForm, Tabs, TabsContent, TabsList, TabsTrigger } from '@real/ui'
import { useOrgSettings, useUpdateGeneralSettings, useUpdateStorefrontSettings } from '@/hooks/use-config'
import { getErrorMessage } from '@/lib/errors'

export function SettingsSection() {
  const settings = useOrgSettings()
  const saveGeneral = useUpdateGeneralSettings()
  const saveStorefront = useUpdateStorefrontSettings()
  const [saved, setSaved] = useState(false)

  const flashSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 4000)
  }

  return (
    <section className="space-y-4" aria-labelledby="org-settings-title">
      <SectionHeader id="org-settings-title" title="Configuración general" />

      {settings.isLoading && (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      )}

      {!settings.isLoading && (settings.error || !settings.data) && (
        <EmptyState
          kind="error"
          description="No se pudo cargar la configuración general."
          action={<Button onClick={() => void settings.refetch()}>Reintentar</Button>}
        />
      )}

      {settings.data && (
        <>
          {saved && <Alert role="status">Configuración guardada.</Alert>}
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="storefront">Storefront</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="pt-4">
              <GeneralSettingsForm
                value={settings.data.general}
                readOnly={!settings.data.canEdit}
                isSaving={saveGeneral.isPending}
                errorMessage={saveGeneral.error ? getErrorMessage(saveGeneral.error) : null}
                onSave={(next) => saveGeneral.mutate(next, { onSuccess: flashSaved })}
              />
            </TabsContent>
            <TabsContent value="storefront" className="pt-4">
              <StorefrontSettingsForm
                value={settings.data.storefront}
                readOnly={!settings.data.canEdit}
                isSaving={saveStorefront.isPending}
                errorMessage={saveStorefront.error ? getErrorMessage(saveStorefront.error) : null}
                onSave={(next) => saveStorefront.mutate(next, { onSuccess: flashSaved })}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </section>
  )
}
