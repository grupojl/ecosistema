import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
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

// Next.js reemplaza process.env.NEXT_PUBLIC_* por strings literales en build.
// Se declara el mínimo para no depender de @types/node en un package browser.
declare const process: { env: Record<string, string | undefined> };

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

  if (getApps().length > 0) {
    _app = getApp();
    return _app;
  }

  // Acceso LITERAL a process.env.NEXT_PUBLIC_*: Next solo las inlinea en el
  // bundle del browser cuando la referencia es estática (no `env(key)` dinámico).
  const apiKey            = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain        = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId         = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket     = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId             = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

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

export async function signInWithApple(): Promise<User> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const result = await signInWithPopup(getFirebaseAuth(), provider);
  return result.user;
}

export async function signInWithFacebook(): Promise<User> {
  const result = await signInWithPopup(getFirebaseAuth(), new FacebookAuthProvider());
  return result.user;
}

/**
 * reauthenticate — confirma de nuevo la identidad del usuario con su mismo proveedor (step-up).
 * Renueva el auth_time del token; el llamador debe recrear después la cookie de sesión.
 * No aplica a sesiones abiertas con custom token (SSO al dashboard): no tienen proveedor.
 */
export async function reauthenticate(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  const providerId = user.providerData[0]?.providerId;
  const provider =
    providerId === 'google.com'   ? new GoogleAuthProvider()   :
    providerId === 'facebook.com' ? new FacebookAuthProvider() :
    providerId === 'apple.com'    ? new OAuthProvider('apple.com') : null;
  if (!provider) throw new Error('No se puede confirmar tu identidad con esta sesión. Cerrá sesión y volvé a ingresar.');
  await reauthenticateWithPopup(user, provider);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export { onAuthStateChanged, type User };
