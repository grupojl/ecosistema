'use client';

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { initializeApp, getApps }                            from 'firebase/app';

// Inicializar Firebase directamente acá para evitar dependencias circulares
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app  = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function SsoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const params      = new URLSearchParams(window.location.search);
        const customToken = params.get('token');

        if (!customToken) {
          setError('Token no encontrado. Volvé a intentarlo.');
          return;
        }

        // 1. Firebase establece la sesión
        await signInWithCustomToken(auth, customToken);

        // 2. Esperar que onAuthStateChanged confirme user != null
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout de sesión')), 8000);
          const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
              clearTimeout(timeout);
              unsub();
              resolve();
            }
          });
        });

        // 3. Navegar al dashboard — el AuthProvider va a hacer el sync
        router.replace('/dashboard');

      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al iniciar sesión');
      }
    };

    run();
  }, [router]);

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive text-center max-w-xs">{error}</p>
        <a href="/login" className="text-xs text-primary underline underline-offset-2">
          Ir al login
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Iniciando sesión...</p>
    </main>
  );
}
