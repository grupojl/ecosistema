'use client';

import { MapPin } from 'lucide-react';
import { PageContainer, EmptyState } from '@real/ui';

// Esta página era específica del dominio real-estate. Welver no tiene zonas: el organigrama del municipio
// (entes) reemplaza esa idea.
export default function ZonasRedirect() {
  return (
    <PageContainer size="md">
      <EmptyState
        icon={<MapPin />}
        title="Zonas"
        description="El módulo de zonas ya no está disponible en esta versión. La estructura del municipio se gestiona desde el organigrama."
      />
    </PageContainer>
  );
}
