import { errorMessage } from '@/http/request';
import { isOrganizationAccessResult } from '@/types/tenant-context';
import { isRecord } from '@/common/prisma/json';
import { z } from 'zod';
import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import type { OrganizationAccessResult } from '@/organizations-client/types/organization-access.types';

const CACHE_TTL_SECONDS = Number(
  process.env['CONFIG_CACHE_TTL_ORG_ACCESS'] ?? 30,
);
const REQUEST_TIMEOUT_MS = 5000;

const ORGANIZATIONS_SERVICE_PREFIX =
  process.env['ORGANIZATIONS_SERVICE_PREFIX'] ?? '/api/v1';
const MARKET_CACHE_TTL = 300;

const ResolvedMarketSchema = z.object({
  id: z.string(),
  countryCode: z.string(),
  isDefault: z.boolean(),
  fulfillmentConfig: z.record(z.string(), z.unknown()),
});
const MarketEnvelopeSchema = z.object({ result: z.object({ data: ResolvedMarketSchema }) });

@Injectable()
export class OrganizationsClientService {
  private readonly logger = new Logger(OrganizationsClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly redis: RedisService) {
    this.baseUrl = (
      process.env['ORGANIZATIONS_SERVICE_URL'] ?? 'http://localhost:3020'
    ).replace(/\/+$/, '');
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
      const parsed: unknown = JSON.parse(cached);
      if (isOrganizationAccessResult(parsed)) return parsed;
      // caché dañada o de otra versión: se ignora y se consulta de nuevo
    }

    const result = await this.fetchFromOrganizationsService(
      firebaseUid,
      organizationId,
    );

    if (result.canAccess) {
      await this.redis
        .set(key, JSON.stringify(result), CACHE_TTL_SECONDS)
        .catch(() => undefined);
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
        headers: {
          'x-internal-api-key': process.env['INTERNAL_API_KEY'] ?? '',
        },
        signal: controller.signal,
      });

      if (response.status === 401) {
        // La credencial de servicio no coincide con la de real-back: es un error de configuración, no del usuario.
        this.logger.error(
          'real-back rechazó INTERNAL_API_KEY — revisar que sea la misma en ambos servicios',
        );
        throw new ServiceUnavailableException(
          'Servicio de identidad mal configurado',
        );
      }
      if (!response.ok) {
        throw new ForbiddenException(
          `real-back respondió ${response.status} para organizationId=${organizationId}`,
        );
      }

      const body: unknown = await response.json();
      if (!isOrganizationAccessResult(body)) {
        throw new ForbiddenException('Respuesta inválida de real-back');
      }
      return body;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      this.logger.error('No se pudo contactar a real-back', errorMessage(error));
      throw new ServiceUnavailableException(
        'Servicio de identidad no disponible temporalmente',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Sesiones cerradas desde "Dispositivos" (ADR-020 / DT-SES-05) ─────────────────────────────────────────────
  private readonly sessionChecks = new Map<
    string,
    { revoked: boolean; at: number }
  >();

  /**
   * ¿La sesión `sid` fue cerrada? Cache de 30 s (una consulta por sesión cada 30 s, no por request).
   * Fail-open: si el sass-back no responde se acepta (la cookie de Firebase ya se verificó), igual que en el sass-back.
   */
  async isSessionRevoked(
    sessionId: string,
    firebaseUid: string,
  ): Promise<boolean> {
    const hit = this.sessionChecks.get(sessionId);
    if (hit && Date.now() - hit.at < 30_000) return hit.revoked;

    try {
      const res = await fetch(
        `${this.baseUrl}${ORGANIZATIONS_SERVICE_PREFIX}/internal/sessions/${encodeURIComponent(sessionId)}/revoked?uid=${encodeURIComponent(firebaseUid)}`,
        {
          headers: {
            'x-internal-api-key': process.env['INTERNAL_API_KEY'] ?? '',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!res.ok) return false;
      const body: unknown = await res.json();
      const revoked = isRecord(body) ? body['revoked'] : undefined;
      if (this.sessionChecks.size >= 10_000) this.sessionChecks.clear();
      this.sessionChecks.set(sessionId, {
        revoked: revoked === true,
        at: Date.now(),
      });
      return revoked === true;
    } catch {
      return false;
    }
  }

  /**
   * Entrega un evento de dominio a los webhooks salientes de la organización (outbox → sass-back). Lanza si no se
   * pudo entregar: el relay del outbox reintenta con espera creciente. Idempotente por `eventId` en el sass-back.
   */
  async publishEvent(
    organizationId: string,
    event: { eventId: string; type: string; payload: Record<string, unknown> },
  ): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}${ORGANIZATIONS_SERVICE_PREFIX}/internal/organizations/${encodeURIComponent(organizationId)}/events`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api-key': process.env['INTERNAL_API_KEY'] ?? '',
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      throw new Error(`sass-back rechazó el evento ${event.type} (HTTP ${res.status})`);
    }
  }

  // ── Markets resolution (MKT-E-01) — ADR-014 ─────────────────────────────────
  async resolveMarket(
    organizationId: string,
    visitorCountryCode: string,
  ): Promise<{
    id: string;
    countryCode: string;
    isDefault: boolean;
    fulfillmentConfig: Record<string, unknown>;
  }> {
    const code = (visitorCountryCode || 'default').toUpperCase();
    const cacheKey = `market:${organizationId}:${code}`;

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      const parsed = ResolvedMarketSchema.safeParse(JSON.parse(cached));
      if (parsed.success) return parsed.data;
    }

    const input = JSON.stringify({
      organizationId,
      countryCode: code === 'DEFAULT' ? 'AR' : code,
    });
    const url = `${this.baseUrl}${ORGANIZATIONS_SERVICE_PREFIX}/trpc/markets.resolve?input=${encodeURIComponent(input)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'x-internal-api-key': process.env['INTERNAL_API_KEY'] ?? '',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          `resolveMarket falló (${response.status}) — usando fallback default`,
        );
        return {
          id: 'default',
          countryCode: 'AR',
          isDefault: true,
          fulfillmentConfig: {},
        };
      }

      // Lo que responde sass-back se valida: una respuesta con otra forma cae al mercado por defecto, no se propaga.
      const { result } = MarketEnvelopeSchema.parse(await response.json());
      const market = result.data;

      await this.redis
        .set(cacheKey, JSON.stringify(market), MARKET_CACHE_TTL)
        .catch(() => undefined);
      return market;
    } catch {
      this.logger.warn('resolveMarket timeout/error — usando fallback default');
      return {
        id: 'default',
        countryCode: 'AR',
        isDefault: true,
        fulfillmentConfig: {},
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
