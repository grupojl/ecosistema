import { Injectable, NotFoundException, Logger } from '@nestjs/common';

export interface StoreInfo {
  organizationId: string;
  slug: string;
  name: string | null;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  ecommerceEnabled: boolean;
}

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);
  private readonly sassBackUrl = process.env['SASS_BACK_URL'] ?? '';

  /**
   * Resuelve un slug al contexto de tienda consultando realsass-sass-back.
   * NO usa prisma — este schema no tiene modelo Organization.
   * realsass-sass-back es el source of truth de organizaciones.
   *
   * Devuelve 404 si:
   *   - SASS_BACK_URL no está configurado
   *   - La org no existe para ese slug
   *   - ecommerceEnabled === false
   */
  async resolveBySlug(slug: string): Promise<StoreInfo> {
    if (!this.sassBackUrl) {
      throw new NotFoundException(
        'SASS_BACK_URL no configurado — no se puede resolver el slug de la tienda.',
      );
    }

    const url = `${this.sassBackUrl}/organizations/public/by-slug/${encodeURIComponent(slug)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
      });
    } catch (err) {
      this.logger.error(`Error de red al contactar sass-back para slug "${slug}": ${String(err)}`);
      throw new NotFoundException('No se pudo conectar al servicio de organizaciones.');
    }

    if (res.status === 404) {
      throw new NotFoundException(`No existe una tienda con el slug "${slug}".`);
    }

    if (!res.ok) {
      this.logger.warn(`sass-back respondió ${res.status} para slug "${slug}"`);
      throw new NotFoundException(`No se pudo resolver la tienda "${slug}".`);
    }

    const body = (await res.json()) as { success: boolean; data: StoreInfo };
    const data = body.data ?? (body as unknown as StoreInfo);

    if (!data.ecommerceEnabled) {
      throw new NotFoundException(
        `La organización "${slug}" no tiene ecommerce habilitado.`,
      );
    }

    return data;
  }
}
