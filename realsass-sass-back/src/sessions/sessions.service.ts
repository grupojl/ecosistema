/**
 * sessions.service.ts — realsass-sass-back (ADR-020)
 *
 * Una fila `UserSession` por login de navegador. El id viaja en la cookie `__sid`.
 * La revocación se consulta con un cache en memoria de 30 s sobre lectura por PK: sin query
 * por request. Una revocación se refleja al instante en esta instancia y en ≤30 s en las demás.
 */
import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { PrismaService } from '@/prisma/prisma.service';
import { SESSION_COOKIE_MAX_AGE_MS } from '@real/auth-server';
import { parseDeviceInfo, type RequestHints } from '@/sessions/device-info';

const REVOKED_CACHE_TTL_MS = 30_000;
const REVOKED_CACHE_MAX = 10_000;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface SessionView {
  id: string;
  deviceType: string;
  browser: string | null;
  os: string | null;
  ipPrefix: string | null;
  country: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  isCurrent: boolean;
}

@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionsService.name);
  private purgeTimer: ReturnType<typeof setInterval> | null = null;
  private readonly revokedCache = new Map<
    string,
    { revoked: boolean; until: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.purgeTimer = setInterval(() => {
      this.purgeExpired().catch((err) =>
        this.logger.warn(`purgeExpired falló: ${String(err)}`),
      );
    }, PURGE_INTERVAL_MS);
    this.purgeTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  /**
   * Crea la sesión o, si `currentSid` es una sesión viva del mismo usuario, renueva `lastSeenAt`
   * y `expiresAt`. Devuelve el `sid` que debe viajar en la cookie (null si el usuario aún no existe).
   */
  async register(
    firebaseUid: string,
    hints: RequestHints,
    currentSid?: string,
  ): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true },
    });
    if (!user) return null; // el User se crea en auth.sync; si falta, el próximo refresh registra la sesión

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_COOKIE_MAX_AGE_MS);

    if (currentSid) {
      const existing = await this.prisma.userSession.findUnique({
        where: { id: currentSid },
      });
      if (
        existing &&
        existing.userId === user.id &&
        !existing.revokedAt &&
        existing.expiresAt > now
      ) {
        await this.prisma.userSession.update({
          where: { id: currentSid },
          data: { lastSeenAt: now, expiresAt },
        });
        return currentSid;
      }
    }

    const created = await this.prisma.userSession.create({
      data: { userId: user.id, expiresAt, ...parseDeviceInfo(hints) },
    });
    return created.id;
  }

  async list(firebaseUid: string, currentSid?: string): Promise<SessionView[]> {
    const rows = await this.prisma.userSession.findMany({
      where: {
        user: { firebaseUid },
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      deviceType: r.deviceType,
      browser: r.browser,
      os: r.os,
      ipPrefix: r.ipPrefix,
      country: r.country,
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt,
      isCurrent: r.id === currentSid,
    }));
  }

  /** Revoca una sesión propia. Ajena o inexistente → NOT_FOUND (no revela si existe). */
  async revoke(firebaseUid: string, sessionId: string): Promise<void> {
    const { count } = await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null, user: { firebaseUid } },
      data: { revokedAt: new Date() },
    });
    if (count === 0)
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Sesión no encontrada',
      });
    this.remember(sessionId, true);
  }

  /** Revoca todas las sesiones del usuario menos `exceptSid`. Devuelve cuántas cerró. */
  async revokeOthers(firebaseUid: string, exceptSid?: string): Promise<number> {
    const targets = await this.prisma.userSession.findMany({
      where: {
        user: { firebaseUid },
        revokedAt: null,
        ...(exceptSid ? { id: { not: exceptSid } } : {}),
      },
      select: { id: true },
    });
    if (targets.length === 0) return 0;
    await this.prisma.userSession.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { revokedAt: new Date() },
    });
    targets.forEach((t) => this.remember(t.id, true));
    return targets.length;
  }

  /** Logout / "cerrar en todos": Firebase ya revocó los refresh tokens, acá se marcan las filas. */
  async revokeAll(firebaseUid: string): Promise<void> {
    await this.revokeOthers(firebaseUid);
  }

  /** Para el middleware de auth. Un id desconocido no se considera revocado (cookies previas a ADR-020). */
  async isRevoked(sessionId: string, firebaseUid: string): Promise<boolean> {
    const hit = this.revokedCache.get(sessionId);
    if (hit && hit.until > Date.now()) return hit.revoked;
    try {
      const row = await this.prisma.userSession.findUnique({
        where: { id: sessionId },
        select: { revokedAt: true, user: { select: { firebaseUid: true } } },
      });
      const revoked =
        !!row &&
        (row.revokedAt !== null || row.user.firebaseUid !== firebaseUid);
      this.remember(sessionId, revoked);
      return revoked;
    } catch (err) {
      // Si la DB falla no se corta a todos los usuarios: la cookie de Firebase ya se verificó.
      this.logger.warn(`isRevoked falló: ${String(err)}`);
      return false;
    }
  }

  /** Borra sesiones vencidas (DT-SES-02). */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.userSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }

  private remember(sessionId: string, revoked: boolean): void {
    if (this.revokedCache.size >= REVOKED_CACHE_MAX) this.revokedCache.clear();
    this.revokedCache.set(sessionId, {
      revoked,
      until: Date.now() + REVOKED_CACHE_TTL_MS,
    });
  }
}
