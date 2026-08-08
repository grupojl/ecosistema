// lib/firebase.ts — Firebase client SDK + helpers de sesión
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!;
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ─── Helpers de sesión (cookie HttpOnly) ─────────────────────────────────────

/**
 * Persiste el ID token en la cookie __session via el Route Handler.
 * Llamar después de signInWithCustomToken o signInWithPopup.
 */
export async function persistSession(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  await fetch('/api/auth/session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ idToken }),
  });
}

/**
 * Borra la cookie __session (logout).
 */
export async function clearSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' });
}

// ─── Helpers de token ────────────────────────────────────────────────────────

/**
 * Espera hasta `timeoutMs` ms a que Firebase resuelva auth.currentUser.
 * Necesario en el primer render post-SSO cuando el SDK todavía no emitió
 * onAuthStateChanged.
 */
function waitForUser(timeoutMs = 3000): Promise<User | null> {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const timer = setTimeout(() => { unsub(); resolve(null); }, timeoutMs);
    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}

/**
 * Retorna el Firebase ID token del usuario actual.
 * - Espera hasta 3s si auth.currentUser es null (post-SSO race condition).
 * - forceRefresh=true renueva el token contra Firebase (para retry en 401).
 * - Si el token fue renovado, actualiza la cookie automáticamente.
 */
export async function getCurrentUserToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser ?? await waitForUser();
  if (!user) throw new Error('No hay usuario autenticado');

  const token = await user.getIdToken(forceRefresh);

  // Actualizar la cookie si pedimos refresh (el token viejo expiró)
  if (forceRefresh) {
    void persistSession(user); // fire-and-forget — no bloquear el fetch
  }

  return token;
}

export { signInWithPopup, signOut, onAuthStateChanged, type User };
