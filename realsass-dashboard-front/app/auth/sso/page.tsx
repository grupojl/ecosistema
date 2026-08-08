// app/auth/sso/page.tsx
//
// Entry point del flujo SSO desde realsass-sass-front.
//
// Flujo:
//   sass-front → POST /api/v1/auth/firebase-sso (sass-back) → customToken
//             → redirect aquí con ?token=<customToken>
//   1. signInWithCustomToken(auth, customToken)
//   2. waitForAuthReady() — espera que Firebase confirme la sesión
//      (sin esto, router.replace('/dashboard') monta los componentes
//       antes de que onAuthStateChanged dispare y los fetches salen sin token)
//   3. router.replace('/dashboard')
'use client';

import { useEffect, useState }        from 'react';
import { useRouter }                  from 'next/navigation';
import { Loader2, AlertCircle }       from 'lucide-react';
import { signInWithCustomToken }      from 'firebase/auth';
import { auth, waitForAuthReady }     from '@/lib/firebase';

type State = 'loading' | 'error';

export default function SsoPage() {
  const router = useRouter();
  const [state,   setState]   = useState<State>('loading');
  const [message, setMessage] = useState('Iniciando sesión...');

  useEffect(() => {
    const run = async () => {
      try {
        const params      = new URLSearchParams(window.location.search);
        const customToken = params.get('token');

        if (!customToken) {
          setMessage('Token no encontrado. Volvé a intentarlo desde el inicio.');
          setState('error');
          return;
        }

        setMessage('Verificando credenciales...');

        // 1. Firebase establece la sesión con el customToken
        await signInWithCustomToken(auth, customToken);

        // 2. Esperar que onAuthStateChanged confirme auth.currentUser !== null
        //    ANTES de navegar. Esto garantiza que cuando el DashboardLayout
        //    y los hooks de TanStack Query monten, el token ya está disponible.
        setMessage('Estableciendo sesión...');
        const user = await waitForAuthReady(5000);

        if (!user) {
          setMessage('No se pudo establecer la sesión. Intentá de nuevo.');
          setState('error');
          return;
        }

        setMessage('Redirigiendo...');
        router.replace('/dashboard');

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        console.error('[SSO]', msg);
        setMessage('No se pudo iniciar sesión. El enlace puede haber expirado.');
        setState('error');
      }
    };

    run();
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      {state === 'loading' && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </>
      )}
      {state === 'error' && (
        <>
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive text-center max-w-xs">{message}</p>
          <a
            href={process.env.NEXT_PUBLIC_SASS_FRONT_URL ?? '/'}
            className="text-xs text-primary underline underline-offset-2"
          >
            Volver al inicio
          </a>
        </>
      )}
    </main>
  );
}
