'use client';

import { Button, EmptyState, GeneralSettingsForm, Skeleton, toast } from '@real/ui';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useOrgSettings, useUpdateGeneralSettings } from '@/features/config-settings/hooks';

/** Configuración general de la organización: región, contacto, horario de atención y asistente de chat. */
export default function GeneralSettingsPage() {
  const { organizationId } = useAuth();
  const settings = useOrgSettings(organizationId);
  const save = useUpdateGeneralSettings();

  if (settings.isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
    </div>
  );

  if (settings.error || !settings.data) return (
    <EmptyState
      kind="error"
      description="No se pudo cargar la configuración general."
      action={<Button onClick={() => void settings.refetch()}>Reintentar</Button>}
    />
  );

  return (
    <GeneralSettingsForm
      value={settings.data.general}
      readOnly={!settings.data.canEdit}
      isSaving={save.isPending}
      errorMessage={save.error?.message ?? null}
      onSave={(next) => save.mutate(next, { onSuccess: () => toast.success('Configuración guardada') })}
    />
  );
}
