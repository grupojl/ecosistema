'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter }    from 'next/navigation';
import { Button, GoogleIcon, LoginPanel, toast, type LoginProvider } from '@real/ui';
import { LocaleSwitcher, loginPanelTexts, useMessages } from '@real/i18n';
import { Logo }         from '@/components/logo';
import type { Dictionary } from '@/lib/i18n';
import { useAuth }      from '@/features/auth/context/auth-context';
import { getDesktopBridge, loopbackStartUrl, safeNextPath, type DesktopBridge } from '@/lib/desktop';

export default function LoginPage() {
  const router              = useRouter();
  const d                   = useMessages<Dictionary>();
  const providers           = useMemo<readonly LoginProvider[]>(
    () => [{ id: 'google', label: d.auth.continueWithGoogle, icon: <GoogleIcon /> }],
    [d.auth.continueWithGoogle],
  );
  const { loginWithGoogle, isAuthenticated, isLoading, authError } = useAuth();
  // App de escritorio (ADR-023): el popup de Google no es confiable en un webview → se inicia sesión en el navegador del sistema.
  const [desktop, setDesktop] = useState<DesktopBridge | null>(null);
  useEffect(() => { setDesktop(getDesktopBridge()); }, []);

  // El AuthProvider hace sync + cookie + perfil (y elige la organización) tras el login de Firebase;
  // recién cuando termina queda autenticado y se entra al dashboard.
  useEffect(() => {
    // `next` permite volver a la página que pidió el login (p. ej. la puente de escritorio); solo rutas internas.
    if (isAuthenticated) router.replace(safeNextPath(new URLSearchParams(window.location.search).get('next')));
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (authError) toast.error(authError);
  }, [authError]);

  // LoginPanel traduce los errores de Firebase (auth/*) y no trata como error cerrar la ventana del proveedor.
  const onSignIn = useCallback(async () => { await loginWithGoogle(); }, [loginWithGoogle]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="absolute right-2 top-2"><LocaleSwitcher label={d.common.language} /></div>
      <div className="w-full max-w-sm">
        {desktop ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center"><Logo className="h-12 w-12 text-foreground" /></div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground">{d.auth.signInHint}</p>
            </div>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => { window.location.href = loopbackStartUrl(desktop.loginPort); }}>
                {d.auth.continueInBrowser}
              </Button>
              <p className="text-xs text-muted-foreground">{d.auth.browserNote}</p>
            </div>
          </div>
        ) : (
          <LoginPanel
            headingAs="h1"
            logo={<Logo className="h-12 w-12 text-foreground" />}
            title="Dashboard"
            description={d.auth.signInHint}
            providers={providers}
            {...loginPanelTexts(d.auth)}
            onSignIn={onSignIn}
            lastUsedKey="dashboard:login:last"
            legal={isLoading ? d.auth.verifyingSession : null}
          />
        )}
      </div>
    </main>
  );
}
