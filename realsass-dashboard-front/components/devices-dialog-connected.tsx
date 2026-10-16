'use client';

/**
 * Modal de dispositivos conectado a sessions.* del sass-back (ADR-020).
 * La UI vive en @real/ui; acá solo se cablea tRPC. La consulta corre únicamente con el modal abierto.
 */
import { useState }       from 'react';
import { toast }          from 'sonner';
import { DevicesDialog }  from '@real/ui';
import { trpc }           from '@/lib/trpc/client';
import { useAuth }        from '@/features/auth/hooks/use-auth';

export function ConnectedDevicesDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const utils    = trpc.useUtils();
  const sessions = trpc.sessions.list.useQuery(undefined, { enabled: open, refetchOnWindowFocus: false });

  const onDone = () => utils.sessions.list.invalidate();
  const onError = (err: { message: string }) => toast.error(err.message);

  const revoke = trpc.sessions.revoke.useMutation({
    onSuccess: () => { toast.success('Sesión cerrada'); return onDone(); },
    onError,
  });
  const revokeOthers = trpc.sessions.revokeOthers.useMutation({
    onSuccess: (res) => { toast.success(`Se cerraron ${res.revoked} sesiones`); return onDone(); },
    onError,
  });

  return (
    <DevicesDialog
      open={open}
      onOpenChange={onOpenChange}
      sessions={sessions.data}
      isLoading={sessions.isLoading}
      error={sessions.error?.message ?? null}
      revokingId={revoke.isPending ? revoke.variables?.sessionId : null}
      isRevokingOthers={revokeOthers.isPending}
      onRevoke={(sessionId) => revoke.mutate({ sessionId })}
      onRevokeOthers={() => revokeOthers.mutate()}
      isLoggingOut={loggingOut}
      onLogout={async () => {
        setLoggingOut(true);
        try {
          await logout();
          onOpenChange(false);
        } finally {
          setLoggingOut(false);
        }
      }}
    />
  );
}
