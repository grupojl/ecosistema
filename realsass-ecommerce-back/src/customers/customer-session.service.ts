import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { parseKeys, requireEnv, safeEqual } from '@real/auth-server';

/**
 * Sesión del cliente del storefront: un token firmado por el servidor.
 *
 * Antes la identidad era el header `x-customer-id`, que arma el propio cliente: quien conociera un
 * customerId operaba esa cuenta. Ahora el customerId SALE del token y el token solo lo emite el
 * servidor (`customer.identify`), así que el cliente no puede fabricar una identidad.
 *
 * Transporte: cookie HttpOnly (ADR-004), emitida por customer.identify. El JavaScript del front nunca ve
 *             el token, así que un XSS no puede robarlo. SameSite=Strict + COOKIE_DOMAIN como la sesión
 *             del dashboard (el storefront y la API comparten dominio raíz).
 *
 * Formato:  v1.<payload base64url>.<firma base64url>   (HMAC-SHA256, sin dependencias nuevas)
 * Payload:  { cid: customerId, oid: organizationId, iat, exp }
 *
 * Secreto:  CUSTOMER_SESSION_SECRET (obligatorio, >= 32 caracteres). Admite varios separados por
 *           coma ("nuevo,viejo"): firma con el primero y verifica con todos => rotable sin cerrar sesiones.
 */
export const CUSTOMER_SESSION_COOKIE = 'store_session' as const;
const VERSION = 'v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export interface CustomerSession {
  customerId:     string;
  organizationId: string;
}

interface Payload { cid: string; oid: string; iat: number; exp: number }

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

@Injectable()
export class CustomerSessionService {
  private readonly secrets: string[];

  constructor() {
    // Falla cerrado: sin secreto el servicio no arranca (no emite tokens "firmados con nada").
    requireEnv('CUSTOMER_SESSION_SECRET', { minLength: 32 });
    this.secrets = parseKeys(process.env['CUSTOMER_SESSION_SECRET']);
    if (this.secrets.some((s) => s.length < 32)) {
      throw new Error('Cada secreto de CUSTOMER_SESSION_SECRET debe tener al menos 32 caracteres');
    }
  }

  private sign(data: string, secret: string): string {
    return b64(createHmac('sha256', secret).update(data).digest());
  }

  /** Atributos de la cookie de sesión. Mismo criterio que la cookie __session del dashboard (ADR-004). */
  cookieOptions() {
    const domain = process.env['COOKIE_DOMAIN']?.trim();
    return {
      httpOnly: true,
      secure:   process.env['NODE_ENV'] === 'production',
      sameSite: 'strict' as const,
      maxAge:   TTL_MS,
      path:     '/',
      ...(domain ? { domain } : {}),
    };
  }

  /** Al borrar, el navegador exige los mismos atributos (path/domain) con que se emitió. */
  clearCookieOptions() {
    const { maxAge: _maxAge, ...rest } = this.cookieOptions();
    return rest;
  }

  issue(session: CustomerSession): { token: string; expiresAt: Date } {
    const now = Date.now();
    const payload: Payload = { cid: session.customerId, oid: session.organizationId, iat: now, exp: now + TTL_MS };
    const body = b64(JSON.stringify(payload));
    const data = `${VERSION}.${body}`;
    const [signer] = this.secrets; // el primero firma; el constructor garantiza que hay al menos uno
    if (!signer) throw new Error('CUSTOMER_SESSION_SECRET sin secretos');
    return { token: `${data}.${this.sign(data, signer)}`, expiresAt: new Date(payload.exp) };
  }

  /** Devuelve la sesión si el token es auténtico y vigente; `null` en cualquier otro caso. */
  verify(token: string | undefined | null): CustomerSession | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== VERSION) return null;
    const [, body, signature] = parts as [string, string, string];

    const data = `${VERSION}.${body}`;
    // Sin cortocircuito: se prueban todos los secretos para no revelar cuál coincidió.
    const authentic = this.secrets.reduce((ok, secret) => safeEqual(signature, this.sign(data, secret)) || ok, false);
    if (!authentic) return null;

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<Payload>;
      if (typeof payload.cid !== 'string' || typeof payload.oid !== 'string' || typeof payload.exp !== 'number') return null;
      if (payload.exp <= Date.now()) return null;
      return { customerId: payload.cid, organizationId: payload.oid };
    } catch {
      return null;
    }
  }
}
