#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 10: Firebase init garantizada antes de cualquier uso
#
# CAUSA RAIZ:
#   En Next.js App Router los chunks de rutas se cargan independientemente.
#   Un componente en /dashboard/page.tsx puede ejecutarse antes de que
#   el layout.tsx haya corrido el import '@/lib/firebase'.
#   Cualquier llamada a getFirebaseAuth() desde ese chunk falla.
#
# SOLUCION:
#   Mover la inicializacion de Firebase DENTRO del paquete @real/auth-client.
#   firebase.ts hace la init automaticamente al ser importado, usando las
#   variables de entorno NEXT_PUBLIC_FIREBASE_* que ya existen en Railway.
#   Asi no importa en que orden se carguen los chunks — Firebase siempre
#   esta inicializado cuando se necesita.
# =============================================================================

set -euo pipefail
[ -f "pnpm-workspace.yaml" ] || { echo "Corre desde la raiz"; exit 1; }

BOLD='\033[1m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
log() { echo -e "${BLUE}[->]${NC} $1"; }
sep() { echo -e "${BOLD}----------------------------------------------------${NC}"; }

sep
echo -e "${BOLD}  FIX 10 — Firebase auto-init en @real/auth-client${NC}"
sep

# =============================================================================
# FIX 1 — packages/auth-client/src/firebase/firebase.ts
# Auto-inicializa Firebase al ser importado si hay variables de entorno.
# initFirebase() sigue disponible para configuracion manual (tests, etc.)
# =============================================================================
log "FIX 1 — Auto-init en packages/auth-client/src/firebase/firebase.ts..."

cat > packages/auth-client/src/firebase/firebase.ts << 'EOF'
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

export interface FirebaseConfig {
  apiKey:            string;
  authDomain:        string;
  projectId:         string;
  storageBucket:     string;
  messagingSenderId: string;
  appId:             string;
}

let _app: FirebaseApp | null = null;

/**
 * initFirebase — inicializa Firebase con una config explicita.
 * Llamar desde el layout si se quiere control explicito.
 * Si no se llama, getFirebaseAuth() auto-inicializa usando NEXT_PUBLIC_FIREBASE_*
 */
export function initFirebase(config: FirebaseConfig): FirebaseApp {
  if (getApps().length > 0) {
    _app = getApp();
  } else {
    _app = initializeApp(config);
  }
  return _app;
}

/**
 * getOrInitApp — obtiene la app de Firebase, inicializando automaticamente
 * si hay variables de entorno NEXT_PUBLIC_FIREBASE_* disponibles.
 * Esto garantiza que Firebase este disponible en cualquier chunk de Next.js
 * sin importar el orden de carga de modulos.
 */
function getOrInitApp(): FirebaseApp {
  if (_app) return _app;

  // Si ya hay una app inicializada por otro medio, usarla
  if (getApps().length > 0) {
    _app = getApp();
    return _app;
  }

  // Auto-init usando variables de entorno NEXT_PUBLIC_FIREBASE_*
  const apiKey            = process.env['NEXT_PUBLIC_FIREBASE_API_KEY'];
  const authDomain        = process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'];
  const projectId         = process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'];
  const storageBucket     = process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'];
  const messagingSenderId = process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'];
  const appId             = process.env['NEXT_PUBLIC_FIREBASE_APP_ID'];

  if (!apiKey || !projectId) {
    throw new Error(
      'Firebase no inicializado. Faltan variables de entorno NEXT_PUBLIC_FIREBASE_API_KEY y NEXT_PUBLIC_FIREBASE_PROJECT_ID. ' +
      'Verificá las variables de entorno en Railway.',
    );
  }

  _app = initializeApp({
    apiKey,
    authDomain:        authDomain        ?? `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket:     storageBucket     ?? `${projectId}.appspot.com`,
    messagingSenderId: messagingSenderId ?? '',
    appId:             appId             ?? '',
  });

  return _app;
}

export function getFirebaseAuth() {
  return getAuth(getOrInitApp());
}

/**
 * getIdToken — obtiene el idToken del usuario actual.
 * @param force true fuerza refresh aunque el token sea valido
 */
export async function getIdToken(force = false): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken(force);
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export { onAuthStateChanged, type User };
EOF
ok "packages/auth-client/src/firebase/firebase.ts"

# =============================================================================
# FIX 2 — dashboard-front/lib/firebase.ts
# Ya no necesita hacer nada especial — el paquete se auto-inicializa.
# Lo simplificamos para que no haga una init duplicada.
# =============================================================================
log "FIX 2 — Simplificando dashboard-front/lib/firebase.ts..."

cat > realsass-dashboard-front/lib/firebase.ts << 'EOF'
/**
 * lib/firebase.ts — dashboard-front
 *
 * Re-exporta desde @real/auth-client para compatibilidad con el codigo
 * existente que importa: auth, signOut, onAuthStateChanged, etc.
 *
 * La inicializacion de Firebase ocurre automaticamente en @real/auth-client
 * usando las variables NEXT_PUBLIC_FIREBASE_* — no se necesita llamar
 * initFirebase() explicitamente.
 */
export {
  getFirebaseAuth as getAuth,
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
  type User,
} from '@real/auth-client';

// Para compatibilidad con codigo que importa 'auth' como objeto
// en lugar de llamar a getAuth()
import { getFirebaseAuth } from '@real/auth-client';
export const auth = getFirebaseAuth();
EOF
ok "dashboard-front/lib/firebase.ts"

# =============================================================================
# FIX 3 — sass-front/lib/firebase.ts — mismo patron
# =============================================================================
log "FIX 3 — Simplificando sass-front/lib/firebase.ts..."

cat > realsass-sass-front/lib/firebase.ts << 'EOF'
/**
 * lib/firebase.ts — sass-front
 *
 * Re-exporta desde @real/auth-client para compatibilidad con:
 *   - components/login-modal.tsx (signInWithGoogle, signInWithApple, signInWithFacebook)
 *   - context/auth-context.tsx   (auth, signOut, onAuthStateChanged)
 *   - lib/api.ts                 (getIdToken)
 *
 * Firebase se auto-inicializa usando NEXT_PUBLIC_FIREBASE_* al primer uso.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

// Auto-init con variables de entorno — mismo patron que el paquete
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider   = new GoogleAuthProvider();
const appleProvider    = new OAuthProvider('apple.com');
const facebookProvider = new FacebookAuthProvider();

appleProvider.addScope('email');
appleProvider.addScope('name');

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithApple() {
  return signInWithPopup(auth, appleProvider);
}

export async function signInWithFacebook() {
  return signInWithPopup(auth, facebookProvider);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function getIdToken(forceRefresh = false): Promise<string> {
  if (!auth.currentUser) throw new Error('No hay usuario autenticado');
  return auth.currentUser.getIdToken(forceRefresh);
}

export { auth, onAuthStateChanged, type User };
EOF
ok "sass-front/lib/firebase.ts"

# =============================================================================
# FIX 4 — dashboard-front layout.tsx: sacar el import de firebase
# que ya no es necesario porque el paquete se auto-inicializa
# =============================================================================
log "FIX 4 — Actualizando dashboard-front/app/layout.tsx..."

cat > realsass-dashboard-front/app/layout.tsx << 'EOF'
import { TrpcProvider }  from '@/lib/trpc/provider'
import type { Metadata } from 'next'
import { Inter }         from 'next/font/google'
import { Toaster }       from 'sonner'
import { QueryProvider } from '@/providers/query-provider'
import { AuthProvider }  from '@/features/auth/context/auth-context'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Stock Apple',
  description: 'Manejo de Stock de Productos Apple',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for (let registration of registrations) {
                  registration.unregister();
                }
              });
            }
          `
        }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>
          <AuthProvider sassBackUrl={process.env.NEXT_PUBLIC_REAL_BACK_URL!}>
            <TrpcProvider>{children}</TrpcProvider>
            <Toaster
              theme="dark"
              position="top-right"
              toastOptions={{
                style: {
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                },
              }}
            />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
EOF
ok "dashboard-front/app/layout.tsx"

sep
echo -e "${BOLD}  FIX 10 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Que se hizo:${NC}"
echo "    @real/auth-client ahora auto-inicializa Firebase con NEXT_PUBLIC_FIREBASE_*"
echo "    No importa en que orden Next.js cargue los chunks — Firebase siempre esta listo"
echo "    dashboard-front/lib/firebase.ts simplificado"
echo "    sass-front/lib/firebase.ts con auto-init propio (compatible con sus imports)"
echo "    dashboard-front/app/layout.tsx sin import de firebase (ya no necesario)"
echo ""
echo "  git add . && git commit -m 'fix: firebase auto-init from env vars in auth-client' && git push"
echo ""
sep