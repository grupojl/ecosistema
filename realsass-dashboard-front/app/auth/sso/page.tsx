'use client'
/**
 * app/auth/sso/page.tsx — realsass-dashboard-front
 *
 * Recibe un custom token Firebase generado por sass-back (POST /auth/firebase-sso)
 * y autentica al colaborador en Firebase para que el AuthProvider haga el sync.
 *
 * Migrado de: inicialización Firebase directa en el componente
 * Ahora usa: @real/auth-client (signInWithCustomToken desde firebase/auth)
 */
import { useEffect, useState }     from 'react';
import { useRouter }               from 'next/navigation';
import { Loader2, AlertCircle }    from 'lucide-react';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { initFirebase }            from '@real/auth-client';

export default function SsoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const token  = params.get('token');

      if (!token) {
        setError('Token de autenticación no encontrado en la URL');
        return;
      }

      try {
        // Usar @real/auth-client para inicializar Firebase
        initFirebase();
        const firebaseAuth = getAuth();

        // 1. Firebase establece la sesión con el custom token
        await signInWithCustomToken(firebaseAuth, token);

        // 2. Esperar confirmación de onAuthStateChanged
        await new Promise<void>((resolve, reject) => {
          const unsub = onAuthStateChanged(firebaseAuth, user => {
            unsub();
            if (user) resolve();
            else reject(new Error('Auth state null después de signInWithCustomToken'));
          });
        });

        // 3. Navegar al dashboard — AuthProvider hace el sync automáticamente
        router.replace('/dashboard');
      } catch (err) {
        console.error('[sso] Error:', err);
        setError('No se pudo completar la autenticación. Intentá de nuevo.');
      }
    };

    run();
  }, [router]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
