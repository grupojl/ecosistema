import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { getApps, initializeApp, cert }         from 'firebase-admin/app';
import { getAuth }                               from 'firebase-admin/auth';

/**
 * getFirebaseAdmin — retorna la instancia de Auth de Firebase Admin.
 * Disponible despues de que FirebaseModule.onModuleInit() corra.
 */
export function getFirebaseAdmin() {
  return getAuth();
}

/**
 * FirebaseModule — inicializa Firebase Admin SDK UNA sola vez.
 * @Global() — disponible en toda la app sin importarlo en cada modulo.
 */
@Global()
@Module({})
export class FirebaseModule implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModule.name);

  onModuleInit(): void {
    if (getApps().length > 0) return;

    const projectId   = process.env['FIREBASE_PROJECT_ID'];
    const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
    const privateKey  = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');

    if (!projectId) {
      this.logger.warn('FIREBASE_PROJECT_ID no configurado — FirebaseModule deshabilitado');
      return;
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase Admin inicializado: ${projectId}`);
  }
}
