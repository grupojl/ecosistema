/**
 * repository/prisma-catalog.repository.ts
 *
 * Adaptador concreto del puerto CatalogRepository, usando Prisma.
 * ESTE es el único archivo del módulo catalog que puede importar
 * PrismaService. Ni domain/ ni catalog.service.ts lo hacen.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ProductDraft } from '../domain/product.entity';
import type {
  CatalogRepository,
  ProductRecord,
  UpdateProductPatch,
} from './catalog.repository.interface';

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, handle: true } },
  variants: {
    include: {
      inventory: {
        select: { quantityAvailable: true, quantityReserved: true },
      },
    },
  },
} as const;

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existsByHandle(organizationId: string, handle: string): Promise<boolean> {
    const count = await this.prisma.product.count({
      where: { organizationId, handle },
    });
    return count > 0;
  }

  async createProduct(
    organizationId: string,
    draft: ProductDraft,
  ): Promise<ProductRecord> {
    const created = await this.prisma.product.create({
      data: {
        organizationId,
        name: draft.name,
        handle: draft.handle,
        description: draft.description,
        categoryId: draft.categoryId,
        variants: {
          create: draft.variants.map((v) => ({
            organizationId,
            sku: v.sku,
            title: v.title,
            priceCents: v.priceCents,
            currency: v.currency ?? 'USD',
          })),
        },
      },
      include: PRODUCT_INCLUDE,
    });

    return created as ProductRecord;
  }

  async findByIdAdmin(
    organizationId: string,
    productId: string,
  ): Promise<ProductRecord | null> {
    const found = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: PRODUCT_INCLUDE,
    });
    return found as ProductRecord | null;
  }

  async listAdmin(organizationId: string): Promise<ProductRecord[]> {
    const list = await this.prisma.product.findMany({
      where: { organizationId },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return list as ProductRecord[];
  }

  async updateProduct(
    organizationId: string,
    productId: string,
    patch: UpdateProductPatch,
  ): Promise<ProductRecord> {
    const updated = await this.prisma.product.update({
      where: { id: productId, organizationId },
      data: patch,
      include: PRODUCT_INCLUDE,
    });
    return updated as ProductRecord;
  }

  async listPublished(
    organizationId: string,
    categoryHandle?: string,
  ): Promise<ProductRecord[]> {
    const list = await this.prisma.product.findMany({
      where: {
        organizationId,
        status: 'PUBLISHED',
        ...(categoryHandle
          ? { category: { handle: categoryHandle } }
          : {}),
      },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return list as ProductRecord[];
  }

  async findPublishedByHandle(
    organizationId: string,
    handle: string,
  ): Promise<ProductRecord | null> {
    const found = await this.prisma.product.findFirst({
      where: { organizationId, handle, status: 'PUBLISHED' },
      include: PRODUCT_INCLUDE,
    });
    return found as ProductRecord | null;
  }
}
