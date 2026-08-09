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
