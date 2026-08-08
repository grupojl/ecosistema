import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
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

/** initFirebase — inicializa el SDK una sola vez. Llamar en el layout raiz. */
export function initFirebase(config: FirebaseConfig): FirebaseApp {
  _app = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  return _app;
}

export function getFirebaseAuth() {
  if (!_app) throw new Error('Firebase no inicializado. Llama a initFirebase() primero.');
  return getAuth(_app);
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
