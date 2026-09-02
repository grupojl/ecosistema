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
import { Public }                from '@real/auth-server';
import { OrganizationsService }  from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * GET /api/v1/organizations/public/by-slug/:slug
   * Pública — sin Firebase auth.
   * Consumida por realsass-ecommerce-back para resolver slug → StoreInfo.
   */
  @Get('public/by-slug/:slug')
  @Public()
  async getBySlugPublic(@Param('slug') slug: string) {
    const store = await this.organizationsService.findBySlugPublic(slug);
    if (!store) throw new NotFoundException(`Organization with slug '${slug}' not found`);
    return store;
  }
}
