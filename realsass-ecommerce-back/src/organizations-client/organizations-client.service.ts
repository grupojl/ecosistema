import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CircuitBreaker, firstKey } from '@real/auth-server';
import { RedisService } from '@/redis/redis.service';
import type { OrganizationAccessResult } from '@/organizations-client/types/organization-access.types';

const CACHE_TTL_SECONDS = Number(process.env['CONFIG_CACHE_TTL_ORG_ACCESS'] ?? 30);
const REQUEST_TIMEOUT_MS = 5000;

const ORGANIZATIONS_SERVICE_PREFIX = process.env['ORGANIZATIONS_SERVICE_PREFIX'] ?? '/api/v1';
const MARKET_CACHE_TTL = 300;

// Si sass-back está lento o caído, cada request del dashboard esperaría el timeout completo y se
// agotarían las conexiones: tras 5 fallos seguidos se corta la llamada 15 s (falla rápido, 503).
const accessBreaker = new CircuitBreaker('sass-back/internal-access', { failureThreshold: 5, resetMs: 15_000 });

/** Clave de servicio que se ENVÍA (la primera de INTERNAL_API_KEY). Sin clave no hay llamada: falla cerrado. */
const internalKey = (): string => firstKey(process.env['INTERNAL_API_KEY'], 'INTERNAL_API_KEY');

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
      const response = await accessBreaker.run(async () => {
        const res = await fetch(url, {
          headers: { 'x-internal-api-key': internalKey() },
          signal: controller.signal,
        });
        // 5xx = el servicio está mal (cuenta para el breaker); el resto son respuestas válidas.
        if (res.status >= 500) throw new Error(`sass-back respondió ${res.status}`);
        return res;
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

  /**
   * ¿La tienda existe y está abierta? `customer.identify` crea filas, así que no se lo permite para una
   * organización inexistente (UUID inventado) ni para una tienda pausada (storeStatus PAUSED, ADR-013).
   * Cacheado: 5 min si está abierta, 1 min si no (una tienda reabierta se nota rápido).
   * Si sass-back no responde NO se asume que está abierta: 503 y no se crea nada (falla cerrado).
   */
  async assertStorefrontOpen(organizationId: string): Promise<void> {
    const key = `store-open:${organizationId}`;
    const cached = await this.redis.get(key).catch(() => null);
    if (cached === '1') return;
    if (cached === '0') throw new NotFoundException('Tienda no encontrada');

    let open: boolean;
    try {
      const res = await accessBreaker.run(async () => {
        const r = await fetch(`${this.baseUrl}/internal/organizations/${encodeURIComponent(organizationId)}`, {
          headers: { 'x-internal-api-key': internalKey() },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (r.status >= 500) throw new Error(`sass-back respondió ${r.status}`);
        return r;
      });
      if (res.status === 404) open = false;
      else if (res.status === 401 || res.status === 403) {
        this.logger.error('sass-back rechazó INTERNAL_API_KEY al consultar la organización — revisar la configuración');
        throw new ServiceUnavailableException('Servicio de identidad mal configurado');
      } else if (!res.ok) open = false;
      else open = ((await res.json()) as { storeStatus?: string }).storeStatus === 'ACTIVE';
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('No se pudo consultar la organización', error as Error);
      throw new ServiceUnavailableException('Servicio de tiendas no disponible temporalmente');
    }

    await this.redis.set(key, open ? '1' : '0', open ? 300 : 60).catch(() => undefined);
    if (!open) throw new NotFoundException('Tienda no encontrada');
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
        headers: { 'x-internal-api-key': internalKey() },
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
