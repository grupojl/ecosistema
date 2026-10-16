/**
 * lib/commerce/firebase.ts — login de clientes de la tienda (ADR-021).
 *
 * Mismo proyecto Firebase que el resto del ecosistema (variables NEXT_PUBLIC_FIREBASE_*). Si faltan, el login queda
 * deshabilitado con un mensaje claro en vez de romper la tienda.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type Auth, type User,
} from 'firebase/auth'

export type { User }

function config() {
  return {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
}

export function isFirebaseConfigured(): boolean {
  const c = config()
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId)
}

function app(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(config())
}

export function authOrNull(): Auth | null {
  return isFirebaseConfigured() ? getAuth(app()) : null
}

/** Observa la sesión. Devuelve la función para dejar de observar. Sin Firebase configurado avisa "sin usuario" al instante. */
export function watchCustomer(onChange: (user: User | null) => void): () => void {
  const auth = authOrNull()
  if (!auth) { onChange(null); return () => undefined }
  return onAuthStateChanged(auth, onChange)
}

/** ID token vigente (el SDK lo renueva solo) o null sin sesión. */
export async function currentIdToken(): Promise<string | null> {
  const user = authOrNull()?.currentUser
  return user ? user.getIdToken() : null
}

/** Google. Lanza si el usuario cierra la ventana (code `auth/popup-closed-by-user`): el llamador lo ignora. */
export async function signInWithGoogle(): Promise<User> {
  const auth = authOrNull()
  if (!auth) throw new Error('firebase-not-configured')
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user
}

export async function signOutCustomer(): Promise<void> {
  const auth = authOrNull()
  if (auth) await fbSignOut(auth)
}
