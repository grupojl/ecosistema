'use client';

import { useEffect, useState } from 'react';
import { Download, MonitorDown, CircleCheck } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton } from '@real/ui';
import { trpc } from '@/lib/trpc/client';
import {
  detectOs, getDesktopBridge, isDesktopOsSupported, safeDownloadUrl,
  type DesktopBridge, type DesktopOs,
} from '@/lib/desktop';

const OS_LABEL: Record<DesktopOs, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux', unknown: 'tu sistema' };

/** Descarga de la app de escritorio (ADR-023). La URL la configura el back (`DESKTOP_DOWNLOAD_URL`) y llega por `desktop.policy`. */
export default function EscritorioPage() {
  const [bridge, setBridge] = useState<DesktopBridge | null>(null);
  const [os, setOs]         = useState<DesktopOs>('unknown');
  useEffect(() => {
    setBridge(getDesktopBridge());
    setOs(detectOs(navigator.userAgent));
  }, []);

  const policy = trpc.desktop.policy.useQuery(undefined, { staleTime: 5 * 60_000 });

  if (policy.isLoading) return <Skeleton className="h-48 w-full" />;
  if (policy.error) {
    return (
      <EmptyState
        icon={<MonitorDown />}
        title="No pudimos consultar la descarga"
        description="Intentá de nuevo en unos minutos."
        action={<Button variant="outline" onClick={() => policy.refetch()}>Reintentar</Button>}
      />
    );
  }

  const url = safeDownloadUrl(policy.data?.downloadUrl);

  if (bridge) {
    return (
      <Alert>
        <CircleCheck className="h-4 w-4" />
        Ya estás usando la app de escritorio{bridge.version ? ` (versión ${bridge.version})` : ''}. Se actualiza sola y te avisa antes de instalar.
      </Alert>
    );
  }

  if (!url) {
    return (
      <EmptyState
        icon={<MonitorDown />}
        title="La app de escritorio todavía no está disponible"
        description="Cuando se publique la primera versión vas a poder descargarla desde acá."
      />
    );
  }

  const supported = isDesktopOsSupported(os);

  return (
    <Card className="space-y-4 border-border p-6">
      <div className="flex items-start gap-3">
        <MonitorDown className="mt-1 h-6 w-6 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="font-display text-xl">App de escritorio</h2>
          <p className="text-sm text-muted-foreground">
            El mismo panel en su propia ventana, con acceso directo y enlaces <code>welver://</code>. Inicia sesión en tu navegador
            y se actualiza sola.
          </p>
        </div>
      </div>
      <Button asChild>
        <a href={url} target="_blank" rel="noreferrer">
          <Download aria-hidden="true" /> Descargar para Windows
        </a>
      </Button>
      {!supported && os !== 'unknown' && (
        <p className="text-xs text-muted-foreground">
          Por ahora el instalador es solo para Windows; en {OS_LABEL[os]} seguí usando el panel desde el navegador.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Si Windows muestra «SmartScreen», elegí «Más información» → «Ejecutar de todos modos»: el instalador aún no tiene firma de código.
      </p>
    </Card>
  );
}
