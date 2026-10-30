'use client';

/**
 * Modal "Informar un problema" conectado a feedback.* del sass-back (ADR-027).
 * La UI vive en @real/ui; acá solo se cablea tRPC. La lista corre únicamente con el modal abierto.
 * El módulo, la ruta y el diagnóstico los pone el sistema; el back agrega release, traceId y user agent.
 */
import { useEffect, useState } from 'react';
import { usePathname }         from 'next/navigation';
import { toast } from '@real/ui';
import { FeedbackDialog, captureClientErrors, getRecentClientErrors, type FeedbackSubmission } from '@real/ui';
import { trpc }                from '@/lib/trpc/client';

export function ConnectedFeedbackDialog({ open, onOpenChange, module }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dónde vive el usuario (p. ej. 'profile', 'dashboard'). */
  module: string;
}) {
  const pathname = usePathname();
  const utils    = trpc.useUtils();
  const reports  = trpc.feedback.listMine.useQuery(undefined, { enabled: open, refetchOnWindowFocus: false });
  const create   = trpc.feedback.create.useMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { captureClientErrors(); }, []);

  const submit = async ({ message, expected, includeDiagnostics }: FeedbackSubmission): Promise<boolean> => {
    setSubmitError(null);
    try {
      await create.mutateAsync({
        message,
        expected,
        module,
        route: pathname || '/',
        diagnostics: includeDiagnostics ? { consoleErrors: getRecentClientErrors() } : undefined,
      });
      toast.success('Reporte enviado. ¡Gracias!');
      await utils.feedback.listMine.invalidate();
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo enviar el reporte');
      return false;
    }
  };

  return (
    <FeedbackDialog
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={submit}
      isSubmitting={create.isPending}
      submitError={submitError}
      diagnosticsPreview={open ? getRecentClientErrors() : []}
      reports={reports.data?.data}
      isLoadingReports={reports.isLoading}
      reportsError={reports.error?.message ?? null}
      onRetryReports={() => void reports.refetch()}
    />
  );
}
