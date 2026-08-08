// lib/firebase.ts
// Firebase client SDK para realsass-dashboard-front.
// Auth exclusivamente via SSO desde realsass-sass-front.
// No hay login propio — signInWithCustomToken es el único entry point.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
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

/**
 * Espera hasta `timeoutMs` ms a que Firebase resuelva auth.currentUser.
 *
 * Necesario después de signInWithCustomToken: Firebase confirma la sesión
 * de forma asíncrona. Sin esta espera, los primeros fetches salen sin token.
 */
export function waitForAuthReady(timeoutMs = 5000): Promise<User | null> {
  return new Promise((resolve) => {
    // Si ya está resuelto, devolver inmediatamente
    if (auth.currentUser !== null) {
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
 * - Espera hasta 5s si auth.currentUser es null (post-SSO).
 * - forceRefresh=true renueva el token contra Firebase (para retry en 401).
 */
export async function getCurrentUserToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser ?? await waitForAuthReady();
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken(forceRefresh);
}

export { signOut, onAuthStateChanged, signInWithCustomToken, type User };
