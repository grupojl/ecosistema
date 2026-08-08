// app/login/page.tsx
//
// El dashboard-front no tiene login propio.
// El acceso es exclusivamente via SSO desde realsass-sass-front.
// Esta página redirige al usuario al sass-front para que inicie sesión allá.
'use client';

import { useEffect }   from 'react';
import { Loader2 }     from 'lucide-react';

const SASS_FRONT_URL = process.env.NEXT_PUBLIC_SASS_FRONT_URL ?? '';

export default function LoginPage() {
  useEffect(() => {
    if (SASS_FRONT_URL) {
      window.location.href = SASS_FRONT_URL;
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Redirigiendo al sistema de organizaciones...
      </p>
      {SASS_FRONT_URL ? (
        <a
          href={SASS_FRONT_URL}
          className="text-xs text-primary underline underline-offset-2"
        >
          Ir ahora
        </a>
      ) : (
        <p className="text-xs text-destructive">
          NEXT_PUBLIC_SASS_FRONT_URL no configurado
        </p>
      )}
    </main>
  );
}
