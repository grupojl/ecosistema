'use client';

import { Button, EmptyState, Skeleton, StorefrontSettingsForm, toast } from '@real/ui';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useOrgSettings, useUpdateStorefrontSettings } from '@/features/config-settings/hooks';

/** Configuración del storefront público: marca, SEO, aviso, redes, enlaces legales y chat web. */
export default function StorefrontSettingsPage() {
  const { organizationId } = useAuth();
  const settings = useOrgSettings(organizationId);
  const save = useUpdateStorefrontSettings();

  if (settings.isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
    </div>
  );

  if (settings.error || !settings.data) return (
    <EmptyState
      kind="error"
      description="No se pudo cargar la configuración del storefront."
      action={<Button onClick={() => void settings.refetch()}>Reintentar</Button>}
    />
  );

  return (
    <StorefrontSettingsForm
      value={settings.data.storefront}
      readOnly={!settings.data.canEdit}
      isSaving={save.isPending}
      errorMessage={save.error?.message ?? null}
      onSave={(next) => save.mutate(next, { onSuccess: () => toast.success('Configuración guardada') })}
    />
  );
}
