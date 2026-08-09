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
