import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService }                         from '@nestjs/config';
import * as admin                                from 'firebase-admin';

/**
 * FirebaseModule — inicializa Firebase Admin SDK UNA sola vez.
 * @Global() — disponible en toda la app sin importarlo en cada modulo.
 *
 * Variables de entorno requeridas:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (con \\n escapados del .env)
 */
@Global()
@Module({})
export class FirebaseModule implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModule.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (admin.apps.length > 0) return;

    const projectId   = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey  = this.config.get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId) {
      this.logger.warn('FIREBASE_PROJECT_ID no configurado — FirebaseModule deshabilitado');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase Admin inicializado: ${projectId}`);
  }
}
