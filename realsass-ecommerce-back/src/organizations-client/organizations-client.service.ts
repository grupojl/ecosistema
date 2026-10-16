import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import type { OrganizationAccessResult } from '@/organizations-client/types/organization-access.types';

const CACHE_TTL_SECONDS = Number(process.env['CONFIG_CACHE_TTL_ORG_ACCESS'] ?? 30);
const REQUEST_TIMEOUT_MS = 5000;

const ORGANIZATIONS_SERVICE_PREFIX = process.env['ORGANIZATIONS_SERVICE_PREFIX'] ?? '/api/v1';
const MARKET_CACHE_TTL = 300;

@Injectable()
export class OrganizationsClientService {
  private readonly logger = new Logger(OrganizationsClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly redis: RedisService) {
    this.baseUrl = (process.env['ORGANIZATIONS_SERVICE_URL'] ?? 'http://localhost:3020').replace(/\/+$/, '');
  }

  private cacheKey(firebaseUid: string, organizationId: string): string {
    return `org-access:${firebaseUid}:${organizationId}`;
  }

  async getAccess(
    _firebaseToken: string, // sin uso: con sesión por cookie no hay Bearer que reenviar (ADR-004)
    firebaseUid: string,
    organizationId: string,
  ): Promise<OrganizationAccessResult> {
    const key = this.cacheKey(firebaseUid, organizationId);

    const cached = await this.redis.get(key).catch(() => null);
    if (cached) {
      return JSON.parse(cached) as OrganizationAccessResult;
    }

    const result = await this.fetchFromOrganizationsService(firebaseUid, organizationId);

    if (result.canAccess) {
      await this.redis.set(key, JSON.stringify(result), CACHE_TTL_SECONDS).catch(() => undefined);
    }

    return result;
  }

  /**
   * Canal servicio-a-servicio: pregunta a sass-back si el usuario puede operar la organización,
   * autenticándose con INTERNAL_API_KEY. No depende del token ni de la cookie del usuario.
   */
  private async fetchFromOrganizationsService(
    firebaseUid: string,
    organizationId: string,
  ): Promise<OrganizationAccessResult> {
    const url = `${this.baseUrl}/internal/access/${encodeURIComponent(organizationId)}/${encodeURIComponent(firebaseUid)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { 'x-internal-api-key': process.env['INTERNAL_API_KEY'] ?? '' },
        signal: controller.signal,
      });

      if (response.status === 401) {
        // La credencial de servicio no coincide con la de real-back: es un error de configuración, no del usuario.
        this.logger.error('real-back rechazó INTERNAL_API_KEY — revisar que sea la misma en ambos servicios');
        throw new ServiceUnavailableException('Servicio de identidad mal configurado');
      }
      if (!response.ok) {
        throw new ForbiddenException(`real-back respondió ${response.status} para organizationId=${organizationId}`);
      }

      return (await response.json()) as OrganizationAccessResult;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException || error instanceof ServiceUnavailableException) throw error;
      this.logger.error('No se pudo contactar a real-back', error as Error);
      throw new ServiceUnavailableException('Servicio de identidad no disponible temporalmente');
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Sesiones cerradas desde "Dispositivos" (ADR-020 / DT-SES-05) ─────────────────────────────────────────────
  private readonly sessionChecks = new Map<string, { revoked: boolean; at: number }>();

  /**
   * ¿La sesión `sid` fue cerrada? Cache de 30 s (una consulta por sesión cada 30 s, no por request).
   * Fail-open: si el sass-back no responde se acepta (la cookie de Firebase ya se verificó), igual que en el sass-back.
   */
  async isSessionRevoked(sessionId: string, firebaseUid: string): Promise<boolean> {
    const hit = this.sessionChecks.get(sessionId);
    if (hit && Date.now() - hit.at < 30_000) return hit.revoked;

    try {
      const res = await fetch(
        `${this.baseUrl}${ORGANIZATIONS_SERVICE_PREFIX}/internal/sessions/${encodeURIComponent(sessionId)}/revoked?uid=${encodeURIComponent(firebaseUid)}`,
        { headers: { 'x-internal-api-key': process.env['INTERNAL_API_KEY'] ?? '' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
      if (!res.ok) return false;
      const { revoked } = (await res.json()) as { revoked?: boolean };
      if (this.sessionChecks.size >= 10_000) this.sessionChecks.clear();
      this.sessionChecks.set(sessionId, { revoked: revoked === true, at: Date.now() });
      return revoked === true;
    } catch {
      return false;
    }
  }

  // ── Markets resolution (MKT-E-01) — ADR-014 ─────────────────────────────────
  async resolveMarket(
    organizationId: string,
    visitorCountryCode: string,
  ): Promise<{ id: string; countryCode: string; isDefault: boolean; fulfillmentConfig: Record<string, unknown> }> {
    const code     = (visitorCountryCode || 'default').toUpperCase();
    const cacheKey = `market:${organizationId}:${code}`;

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as { id: string; countryCode: string; isDefault: boolean; fulfillmentConfig: Record<string, unknown> };

    const input      = JSON.stringify({ organizationId, countryCode: code === 'DEFAULT' ? 'AR' : code });
    const url        = `${this.baseUrl}${ORGANIZATIONS_SERVICE_PREFIX}/trpc/markets.resolve?input=${encodeURIComponent(input)}`;

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { 'x-internal-api-key': process.env['INTERNAL_API_KEY'] ?? '' },
        signal:  controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`resolveMarket falló (${response.status}) — usando fallback default`);
        return { id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} };
      }

      const body   = await response.json() as { result: { data: unknown } };
      const market = body.result.data as { id: string; countryCode: string; isDefault: boolean; fulfillmentConfig: Record<string, unknown> };

      await this.redis.set(cacheKey, JSON.stringify(market), MARKET_CACHE_TTL).catch(() => undefined);
      return market;
    } catch {
      this.logger.warn('resolveMarket timeout/error — usando fallback default');
      return { id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} };
    } finally {
      clearTimeout(timeout);
    }
  }
}
