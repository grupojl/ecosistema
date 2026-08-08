// app/auth/sso/page.tsx
//
// Flujo:
//   1. Lee el customToken de la URL (?token=...)
//   2. signInWithCustomToken → Firebase establece la sesión
//   3. Espera onAuthStateChanged para confirmar que user != null
//   4. getIdToken() → POST /api/auth/session → cookie __session seteada
//   5. router.replace('/dashboard')  ← ahora el middleware ve la cookie
//
// El paso 3-4 antes del redirect es la clave: garantiza que el middleware
// tenga la cookie Y que Firebase SDK tenga auth.currentUser antes de que
// cualquier componente del dashboard intente hacer un fetch.
'use client';

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, persistSession }  from '@/lib/firebase';

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
        const credential = await signInWithCustomToken(auth, customToken);

        setMessage('Guardando sesión...');

        // 2. Persistir el ID token en la cookie HttpOnly ANTES de navegar.
        //    Esto garantiza que el middleware vea la cookie en el primer request
        //    a /dashboard, y que auth.currentUser != null cuando los componentes monten.
        await persistSession(credential.user);

        setMessage('Redirigiendo...');

        // 3. Ahora sí navegamos — el middleware tiene la cookie y el SDK tiene el user
        router.replace('/dashboard');

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        console.error('[SSO] Error:', msg);
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
          <a href="/" className="text-xs text-primary underline underline-offset-2">
            Volver al inicio
          </a>
        </>
      )}
    </main>
  );
}
