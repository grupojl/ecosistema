import { Injectable, NotFoundException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { parseSassBackStoreResponse, type StoreInfo } from '@/store/store.contract';

export type { StoreInfo };

const FRESH_MS = 60_000;      // dentro de este plazo no se vuelve a consultar al sass-back
const STALE_MS = 10 * 60_000; // si el sass-back falla, se sirve el último resultado bueno hasta este plazo
const MAX_ENTRIES = 500;

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);
  private readonly sassBackUrl = process.env['SASS_BACK_URL'] ?? '';
  private readonly cache = new Map<string, { store: StoreInfo; at: number }>();
  private readonly inflight = new Map<string, Promise<StoreInfo>>();
  private readonly orgChecks = new Map<string, { ok: boolean; at: number }>();

  /**
   * Resuelve un slug al contexto de tienda consultando realsass-sass-back.
   * realsass-sass-back es el source of truth de organizaciones.
   *
   * Semántica de errores (importa para SEO):
   *   - 404 → la tienda NO existe / está pausada. Google la desindexa.
   *   - 503 → falla transitoria de infraestructura. Google reintenta y
   *           CONSERVA la indexación. Antes todo era 404: un blip de red
   *           de sass-back podía desindexar tiendas enteras.
   */
  async resolveBySlug(slug: string): Promise<StoreInfo> {
    // Un render del storefront resuelve la tienda varias veces (layout, página, metadata) y, sin esto, cada una era
    // una llamada HTTP al sass-back. Se cachea 60 s y las llamadas simultáneas comparten una sola consulta.
    const hit = this.cache.get(slug);
    if (hit && Date.now() - hit.at < FRESH_MS) return hit.store;

    const pending = this.inflight.get(slug);
    if (pending) return pending;

    const request = this.fetchStore(slug)
      .then((store) => {
        if (this.cache.size >= MAX_ENTRIES) this.cache.clear();
        this.cache.set(slug, { store, at: Date.now() });
        return store;
      })
      .catch((err: unknown) => {
        // Solo las fallas de infraestructura (503) caen al último resultado bueno. Un 404 es la verdad: la tienda
        // no existe o fue pausada, y Google tiene que enterarse.
        if (err instanceof ServiceUnavailableException && hit && Date.now() - hit.at < STALE_MS) {
          this.logger.warn(`sass-back no respondió para "${slug}"; se sirve la copia de hace ${Math.round((Date.now() - hit.at) / 1000)} s`);
          return hit.store;
        }
        throw err;
      })
      .finally(() => this.inflight.delete(slug));

    this.inflight.set(slug, request);
    return request;
  }

  private storesCache: { at: number; value: Array<{ slug: string; countryCode: string; updatedAt: string }> } | null = null;

  /**
   * Tiendas activas para el sitemap del storefront (índice `/sitemaps`). Caché de 10 min. Si el sass-back no responde se
   * sirve la última copia (hasta 1 h); sin copia, 503 (nunca una lista vacía que haría pensar que no hay tiendas).
   */
  async listStores(): Promise<Array<{ slug: string; countryCode: string; updatedAt: string }>> {
    const hit = this.storesCache;
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;

    try {
      if (!this.sassBackUrl) throw new Error('SASS_BACK_URL no configurado');
      const res = await fetch(`${this.sassBackUrl}/organizations/public/stores`, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`sass-back respondió ${res.status}`);
      const body: unknown = await res.json();
      const rows = Array.isArray(body) ? body : [];
      const value = rows.flatMap((r: unknown) => {
        if (typeof r !== 'object' || r === null) return [];
        const o = r as { slug?: unknown; countryCode?: unknown; updatedAt?: unknown };
        return typeof o.slug === 'string' && typeof o.countryCode === 'string' && typeof o.updatedAt === 'string'
          ? [{ slug: o.slug, countryCode: o.countryCode, updatedAt: o.updatedAt }]
          : [];
      });
      this.storesCache = { at: Date.now(), value };
      return value;
    } catch (err) {
      this.logger.error(`No se pudo listar las tiendas para el sitemap: ${String(err)}`);
      if (hit && Date.now() - hit.at < 60 * 60_000) return hit.value;
      throw new ServiceUnavailableException('No se pudo obtener el listado de tiendas.');
    }
  }

  /**
   * ¿Existe esta organización y tiene el ecommerce habilitado? Se usa para no crear clientes con ids arbitrarios (ADR-021).
   * true/false según el sass-back; una falla de infraestructura LANZA (503), no se confunde con "no existe".
   * Cache de 60 s (positivo y negativo) para no consultar en cada request.
   */
  async organizationIsEnabled(organizationId: string): Promise<boolean> {
    const hit = this.orgChecks.get(organizationId);
    if (hit && Date.now() - hit.at < FRESH_MS) return hit.ok;

    if (!this.sassBackUrl) throw new ServiceUnavailableException('Servicio de organizaciones no configurado.');
    let res: Response;
    try {
      res = await fetch(`${this.sassBackUrl}/organizations/public/by-id/${encodeURIComponent(organizationId)}`, { signal: AbortSignal.timeout(5_000) });
    } catch (err) {
      this.logger.error(`Error de red validando la organización ${organizationId}: ${String(err)}`);
      throw new ServiceUnavailableException('No se pudo conectar al servicio de organizaciones.');
    }
    if (res.status !== 404 && !res.ok) throw new ServiceUnavailableException(`No se pudo validar la organización (${res.status}).`);

    let ok = false;
    if (res.ok) {
      const store = parseSassBackStoreResponse(await res.json());
      ok = !!store && store.ecommerceEnabled;
    }
    if (this.orgChecks.size >= MAX_ENTRIES) this.orgChecks.clear();
    this.orgChecks.set(organizationId, { ok, at: Date.now() });
    return ok;
  }

  private async fetchStore(slug: string): Promise<StoreInfo> {
    if (!this.sassBackUrl) {
      this.logger.error('SASS_BACK_URL no configurado');
      throw new ServiceUnavailableException('Servicio de organizaciones no configurado.');
    }

    const url = `${this.sassBackUrl}/organizations/public/by-slug/${encodeURIComponent(slug)}`;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    } catch (err) {
      this.logger.error(`Error de red al contactar sass-back para slug "${slug}": ${String(err)}`);
      throw new ServiceUnavailableException('No se pudo conectar al servicio de organizaciones.');
    }

    if (res.status === 404) {
      throw new NotFoundException(`No existe una tienda con el slug "${slug}".`);
    }

    if (!res.ok) {
      this.logger.warn(`sass-back respondió ${res.status} para slug "${slug}"`);
      throw new ServiceUnavailableException(`No se pudo resolver la tienda "${slug}".`);
    }

    const store = parseSassBackStoreResponse(await res.json());
    if (!store) {
      this.logger.error(`Contrato inválido de sass-back para slug "${slug}"`);
      throw new ServiceUnavailableException('Respuesta inválida del servicio de organizaciones.');
    }

    if (!store.ecommerceEnabled) {
      throw new NotFoundException(`La organización "${slug}" no tiene ecommerce habilitado.`);
    }

    return store;
  }
}
