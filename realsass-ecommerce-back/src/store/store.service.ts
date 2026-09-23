import { Injectable, NotFoundException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { parseSassBackStoreResponse, type StoreInfo } from '@/store/store.contract';

export type { StoreInfo };

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);
  private readonly sassBackUrl = process.env['SASS_BACK_URL'] ?? '';

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
