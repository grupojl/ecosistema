import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { getFirebaseAdmin }                          from '@/firebase/firebase.module';

export const SESSION_COOKIE_NAME = '__session' as const;
export const SESSION_COOKIE_MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000;

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure:   boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge:   number;
  path:     string;
}

export interface VerifiedSession {
  uid:   string;
  email: string | undefined;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  async createSessionCookie(idToken: string): Promise<string> {
    try {
      await getFirebaseAdmin().verifyIdToken(idToken, true);
      const sessionCookie = await getFirebaseAdmin().createSessionCookie(idToken, {
        expiresIn: SESSION_COOKIE_MAX_AGE_MS,
      });
      return sessionCookie;
    } catch (err) {
      this.logger.warn('createSessionCookie failed', { error: String(err) });
      throw new UnauthorizedException('Token de Firebase inválido o expirado');
    }
  }

  async verifySessionCookie(sessionCookie: string): Promise<VerifiedSession> {
    try {
      const decoded = await getFirebaseAdmin().verifySessionCookie(sessionCookie, true);
      return { uid: decoded.uid, email: decoded.email };
    } catch (err) {
      this.logger.warn('verifySessionCookie failed', { error: String(err) });
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
  }

  async revokeSession(uid: string): Promise<void> {
    try {
      await getFirebaseAdmin().revokeRefreshTokens(uid);
      this.logger.log(`Session revoked for uid=${uid}`);
    } catch (err) {
      this.logger.error('revokeSession failed', { uid, error: String(err) });
    }
  }

  cookieOptions(secure = true): SessionCookieOptions {
    return { httpOnly: true, secure, sameSite: 'strict', maxAge: SESSION_COOKIE_MAX_AGE_MS, path: '/' };
  }

  getCookieOptions(): SessionCookieOptions {
    return this.cookieOptions(true);
  }

  getClearCookieOptions(): SessionCookieOptions {
    return { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 0, path: '/' };
  }
}
