/**
 * organizations.controller.ts — realsass-sass-back
 *
 * REST endpoint que DEBE quedar en REST (ADR-005):
 *
 *   GET /organizations/public/by-slug/:slug
 *     Consumido por realsass-ecommerce-back vía HTTP (back-to-back).
 *     No puede ser tRPC porque ecommerce-back no tiene cliente React.
 *
 * Los endpoints de owner (getMyOrg, updateMyOrg) migraron a:
 *   organizations.me → tRPC
 *   organizations.update → tRPC
 */
import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public }                from '@real/auth-server';
import { OrganizationsService }  from '@/organizations/organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * GET /api/v1/organizations/public/by-slug/:slug
   * Pública — sin Firebase auth.
   * Consumida por realsass-ecommerce-back para resolver slug → StoreInfo.
   */
  // Lo llama el ecommerce-back por cada render del storefront, y todo ese tráfico sale de UNA IP. El límite estricto
  // `auth` (10/min, pensado para el login) y el global (30/min) lo dejaban en 429 con ~10 vistas por minuto.
  // Sitemap del storefront: lista pública de tiendas activas (solo slug, país y fecha). Las tiendas ya son páginas públicas e indexables.
  @SkipThrottle({ auth: true })
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('public/stores')
  @Public()
  async listStoresPublic() {
    return this.organizationsService.listPublicStores();
  }

  @SkipThrottle({ auth: true })
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Get('public/by-id/:id')
  @Public()
  async getByIdPublic(@Param('id') id: string) {
    const store = await this.organizationsService.findByIdPublic(id);
    if (!store) throw new NotFoundException(`Organization with id '${id}' not found`);
    return store;
  }

  @SkipThrottle({ auth: true })
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Get('public/by-slug/:slug')
  @Public()
  async getBySlugPublic(@Param('slug') slug: string) {
    const store = await this.organizationsService.findBySlugPublic(slug);
    if (!store) throw new NotFoundException(`Organization with slug '${slug}' not found`);
    return store;
  }
}
