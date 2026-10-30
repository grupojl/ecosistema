'use client';

/**
 * Página puente del login de la app de escritorio (ADR-023, F1). Corre en el NAVEGADOR DEL SISTEMA, no en la app.
 *
 *   1. La app abre  /desktop-login?port=…&state=…&challenge=…  en el navegador (PKCE: solo viaja el challenge).
 *   2. Si no hay sesión, manda a /login (y vuelve acá con ?next=).
 *   3. Con sesión, pide un CÓDIGO de un solo uso (auth.issueDesktopLoginCode) y vuelve a http://127.0.0.1:{port}/callback.
 *   4. La app verifica el `state`, navega su webview a /auth/desktop?code=…&verifier=… y ahí se canjea por el token.
 *
 * Puerto, state y challenge se validan antes de redirigir: solo se redirige a loopback, y nunca viaja un token.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CircleAlert, CircleCheck } from 'lucide-react';
import { useAuth } from '@/features/auth/context/auth-context';
import { trpc } from '@/lib/trpc/client';
import { isValidChallenge, isValidState, loopbackCallbackUrl, parsePort } from '@/lib/desktop';

type Status = 'checking' | 'requesting' | 'done' | 'invalid' | 'error';

export default function DesktopLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const issueCode = trpc.auth.issueDesktopLoginCode.useMutation();
  const [status, setStatus] = useState<Status>('checking');
  const started = useRef(false);

  useEffect(() => {
    if (isLoading || started.current) return;

    const params = new URLSearchParams(window.location.search);
    const port = parsePort(params.get('port'));
    const state = params.get('state');
    const challenge = params.get('challenge');
    if (port === null || !isValidState(state) || !isValidChallenge(challenge)) { setStatus('invalid'); return; }

    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    started.current = true; // un solo código por visita
    setStatus('requesting');
    issueCode.mutateAsync({ challenge })
      .then(({ code }) => {
        setStatus('done');
        window.location.href = loopbackCallbackUrl(port, state, code);
      })
      .catch(() => setStatus('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm text-center space-y-4">
        {(status === 'checking' || status === 'requesting') && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Conectando con la aplicación de escritorio…</p>
          </>
        )}
        {status === 'done' && (
          <>
            <CircleCheck className="h-10 w-10 text-success-ink mx-auto" />
            <p className="text-sm">Listo. Volvé a la aplicación: ya podés cerrar esta pestaña.</p>
          </>
        )}
        {status === 'invalid' && (
          <>
            <CircleAlert className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">Este enlace no es válido. Volvé a la aplicación e intentá de nuevo.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <CircleAlert className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">No pudimos completar el inicio de sesión. Volvé a la aplicación e intentá de nuevo.</p>
          </>
        )}
      </div>
    </main>
  );
}
