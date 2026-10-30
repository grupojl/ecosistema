import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import { AuthService } from '@/auth/auth.service';

/**
 * Login de la app de escritorio con código de un solo uso + PKCE (DT-DESK-3, norte de desktop pilar 1).
 *
 *   1. La app (Tauri) genera un `verifier` secreto y manda solo su `challenge = hex(SHA-256(verifier))` al navegador del sistema.
 *   2. Ya autenticado en el navegador, `issue` guarda { uid, challenge } bajo un CÓDIGO aleatorio (60 s, un solo uso).
 *      Por el loopback viaja ese código, nunca un token: robarlo de la URL no sirve sin el verifier.
 *   3. El webview de la app llama `redeem(code, verifier)`: el código se consume, se comprueba el challenge y recién ahí
 *      se emite el custom token de Firebase.
 *
 * Sin Redis se usa memoria SOLO fuera de producción: con varias instancias un código emitido en una no lo vería otra.
 */
const CODE_TTL_SECONDS = 60;
const KEY_PREFIX = 'desktop-login:';
const HEX_64 = /^[a-f0-9]{64}$/;

interface Stored {
  uid: string;
  challenge: string;
}

@Injectable()
export class DesktopLoginService {
  private readonly memory = new Map<
    string,
    { value: string; expires: number }
  >();

  constructor(
    private readonly redis: RedisService,
    private readonly auth: AuthService,
  ) {}

  async issue(
    uid: string,
    challenge: string,
  ): Promise<{ code: string; expiresIn: number }> {
    if (!HEX_64.test(challenge))
      throw new UnauthorizedException('Solicitud inválida');
    const code = randomBytes(32).toString('base64url');
    await this.put(code, JSON.stringify({ uid, challenge } satisfies Stored));
    return { code, expiresIn: CODE_TTL_SECONDS };
  }

  async redeem(
    code: string,
    verifier: string,
  ): Promise<{ customToken: string }> {
    // Mismo error ante cualquier falla: no se revela si el código existía, venció o el verifier no coincidía.
    const invalid = new UnauthorizedException('Código inválido o vencido');
    if (!HEX_64.test(verifier)) throw invalid;

    const raw = await this.take(code);
    if (!raw) throw invalid;
    const { uid, challenge } = JSON.parse(raw) as Stored;

    const actual = Buffer.from(
      createHash('sha256').update(verifier).digest('hex'),
    );
    const expected = Buffer.from(challenge);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw invalid;

    return this.auth.generateCustomTokenForUid(uid);
  }

  // ── almacenamiento ──────────────────────────────────────────────────────────

  private get useRedis(): boolean {
    return this.redis.isConnected;
  }

  private async put(code: string, value: string): Promise<void> {
    if (this.useRedis)
      return this.redis.set(KEY_PREFIX + code, value, CODE_TTL_SECONDS);
    this.requireMemoryAllowed();
    this.sweep();
    this.memory.set(code, {
      value,
      expires: Date.now() + CODE_TTL_SECONDS * 1000,
    });
  }

  /** Lee Y borra en un solo paso: dos canjes simultáneos no pueden ganar los dos. */
  private async take(code: string): Promise<string | null> {
    if (this.useRedis) return this.redis.getDel(KEY_PREFIX + code);
    this.requireMemoryAllowed();
    const entry = this.memory.get(code);
    this.memory.delete(code);
    return entry && entry.expires > Date.now() ? entry.value : null;
  }

  private requireMemoryAllowed(): void {
    if (process.env['NODE_ENV'] === 'production') {
      throw new ServiceUnavailableException(
        'El inicio de sesión de escritorio requiere Redis en producción',
      );
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.memory)
      if (v.expires <= now) this.memory.delete(k);
  }
}
