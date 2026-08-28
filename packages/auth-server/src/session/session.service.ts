/**
 * session.service.ts — @real/auth-server
 *
 * Centraliza la creación, verificación y revocación de Firebase Session Cookies.
 * Consumido por AuthSessionController en cada back NestJS.
 *
 * Por qué Firebase Session Cookies en lugar de JWT propio:
 *   - Verificables sin round-trip extra a Firebase (verifySessionCookie)
 *   - Revocables server-side (revokeRefreshTokens)
 *   - Hasta 2 semanas de vida configurable
 *   - Ver ADR-004-auth-session-cookies.md
 */
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { getFirebaseAdmin }                          from '../firebase/firebase.module';

export const SESSION_COOKIE_NAME = '__session' as const;
export const SESSION_COOKIE_MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000; // 14 días

export interface SessionCookieOptions {
  httpOnly:  boolean;
  secure:    boolean;
  sameSite:  'strict' | 'lax' | 'none';
  maxAge:    number;
  path:      string;
}

export interface VerifiedSession {
  uid:   string;
  email: string | undefined;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  /**
   * Crea una Firebase Session Cookie a partir de un ID token.
   * El ID token viene del front tras autenticarse con Firebase SDK.
   *
   * @throws UnauthorizedException si el token es inválido o está expirado
   */
  async createSessionCookie(idToken: string): Promise<string> {
    try {
      const admin = getFirebaseAdmin();
      // Verificar primero que el token es válido y reciente (checkRevoked: true)
      await admin.auth().verifyIdToken(idToken, true);

      const sessionCookie = await admin.auth().createSessionCookie(idToken, {
        expiresIn: SESSION_COOKIE_MAX_AGE_MS,
      });

      return sessionCookie;
    } catch (err) {
      this.logger.warn('createSessionCookie failed', { error: String(err) });
      throw new UnauthorizedException('Token de Firebase inválido o expirado');
    }
  }

  /**
   * Verifica una Session Cookie y retorna el uid + email del usuario.
   *
   * @throws UnauthorizedException si la cookie es inválida, expirada o revocada
   */
  async verifySessionCookie(sessionCookie: string): Promise<VerifiedSession> {
    try {
      const admin   = getFirebaseAdmin();
      // checkRevoked: true → falla si el usuario cerró sesión en otro dispositivo
      const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
      return {
        uid:   decoded.uid,
        email: decoded.email,
      };
    } catch (err) {
      this.logger.warn('verifySessionCookie failed', { error: String(err) });
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
  }

  /**
   * Revoca todos los refresh tokens del usuario → invalida la session cookie
   * en todos los dispositivos.
   * Llamado en logout.
   */
  async revokeSession(uid: string): Promise<void> {
    try {
      const admin = getFirebaseAdmin();
      await admin.auth().revokeRefreshTokens(uid);
      this.logger.log(`Session revoked for uid=${uid}`);
    } catch (err) {
      // No relanzar — el logout debe completarse aunque la revocación falle
      this.logger.error('revokeSession failed', { uid, error: String(err) });
    }
  }

  /**
   * Retorna las opciones de cookie para res.cookie().
   * secure: true siempre en producción; en desarrollo Railway usa HTTPS por defecto.
   */
  getCookieOptions(): SessionCookieOptions {
    return {
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
      maxAge:   SESSION_COOKIE_MAX_AGE_MS,
      path:     '/',
    };
  }

  /**
   * Opciones de cookie para logout (maxAge: 0 elimina la cookie del browser).
   */
  getClearCookieOptions(): SessionCookieOptions {
    return {
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
      maxAge:   0,
      path:     '/',
    };
  }
}
