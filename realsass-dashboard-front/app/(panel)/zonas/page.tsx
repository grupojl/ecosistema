'use client';

import { MapPin } from 'lucide-react';
import { PageContainer, EmptyState } from '@real/ui';

// Esta página era específica del dominio real-estate.
// En la versión genérica las categorías de productos se gestionan
// desde /tienda/productos.
export default function ZonasRedirect() {
  return (
    <PageContainer size="md">
      <EmptyState
        icon={<MapPin />}
        title="Zonas"
        description="El módulo de zonas ya no está disponible en esta versión. Las categorías se gestionan desde la sección Tienda → Productos."
      />
    </PageContainer>
  );
}
