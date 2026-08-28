/**
 * repository/catalog.repository.interface.ts
 *
 * Puerto (interface) de la capa Repository. La capa Application
 * (catalog.service.ts) depende SOLO de esta interfaz, nunca de la
 * implementación concreta (PrismaCatalogRepository).
 *
 * Esto permite:
 *   - Testear el Service mockeando este contrato, sin levantar Postgres.
 *   - Cambiar de Prisma a otro ORM/driver sin tocar Application ni Domain.
 *
 * Token de inyección: CATALOG_REPOSITORY (ver catalog.module.ts)
 */

import type { ProductDraft } from '../domain/product.entity';

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface ProductRecord {
  id: string;
  organizationId: string;
  categoryId: string | null;
  name: string;
  handle: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
  variants: ProductVariantRecord[];
  category: { id: string; name: string; handle: string } | null;
}

export interface ProductVariantRecord {
  id: string;
  productId: string;
  sku: string;
  title: string;
  priceCents: number;
  currency: string;
  inventory: { quantityAvailable: number; quantityReserved: number } | null;
}

export interface UpdateProductPatch {
  name?: string;
  description?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface CatalogRepository {
  /**
   * Verifica si ya existe un producto con ese handle en la organización.
   * Usado por Application antes de crear, para dar un error de negocio
   * claro en vez de esperar el constraint violation de Postgres.
   */
  existsByHandle(organizationId: string, handle: string): Promise<boolean>;

  createProduct(
    organizationId: string,
    draft: ProductDraft,
  ): Promise<ProductRecord>;

  findByIdAdmin(
    organizationId: string,
    productId: string,
  ): Promise<ProductRecord | null>;

  listAdmin(organizationId: string): Promise<ProductRecord[]>;

  updateProduct(
    organizationId: string,
    productId: string,
    patch: UpdateProductPatch,
  ): Promise<ProductRecord>;

  // ── Público (storefront) ────────────────────────────────────────────────

  listPublished(
    organizationId: string,
    categoryHandle?: string,
  ): Promise<ProductRecord[]>;

  findPublishedByHandle(
    organizationId: string,
    handle: string,
  ): Promise<ProductRecord | null>;
}
