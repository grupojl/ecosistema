/**
 * catalog.service.ts — capa Application
 *
 * Orquesta domain (reglas puras) + repository (persistencia).
 * NO importa PrismaService. NO contiene reglas de negocio propias —
 * esas viven en domain/product.entity.ts. Este service:
 *   1. Arma el ProductDraft desde el DTO de entrada.
 *   2. Le pide al domain que valide invariantes.
 *   3. Traduce DomainError → excepción HTTP apropiada.
 *   4. Delega la persistencia al Repository.
 */

import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { validateProductDraft, canPublish } from './domain/product.entity';
import { DomainError } from './domain/product.errors';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from './repository/catalog.repository.interface';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: CatalogRepository,
  ) {}

  // ── Admin ────────────────────────────────────────────────────────────

  async createProduct(organizationId: string, dto: CreateProductDto) {
    const draft = {
      name: dto.name,
      handle: dto.handle,
      description: dto.description,
      categoryId: dto.categoryId,
      variants: dto.variants,
    };

    try {
      validateProductDraft(draft);
    } catch (err) {
      throw this.toHttpException(err);
    }

    const alreadyExists = await this.catalogRepository.existsByHandle(
      organizationId,
      draft.handle,
    );
    if (alreadyExists) {
      throw new ConflictException(
        `Ya existe un producto con el handle "${draft.handle}" en esta organización.`,
      );
    }

    return this.catalogRepository.createProduct(organizationId, draft);
  }

  async listProductsAdmin(organizationId: string) {
    return this.catalogRepository.listAdmin(organizationId);
  }

  async updateProduct(
    organizationId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    const existing = await this.catalogRepository.findByIdAdmin(
      organizationId,
      productId,
    );
    if (!existing) {
      throw new NotFoundException(`Producto ${productId} no encontrado.`);
    }

    // Regla de dominio: no se puede publicar sin stock disponible.
    if (dto.status === 'PUBLISHED') {
      const hasStock = canPublish(
        existing.variants.map((v) => ({
          quantityAvailable: v.inventory?.quantityAvailable ?? 0,
        })),
      );
      if (!hasStock) {
        throw new UnprocessableEntityException(
          `El producto ${productId} no puede publicarse: ninguna variante tiene stock.`,
        );
      }
    }

    return this.catalogRepository.updateProduct(organizationId, productId, dto);
  }

  // ── Público (storefront) ─────────────────────────────────────────────

  async listProductsPublic(organizationId: string, categoryHandle?: string) {
    return this.catalogRepository.listPublished(organizationId, categoryHandle);
  }

  async getProductPublic(organizationId: string, handle: string) {
    const product = await this.catalogRepository.findPublishedByHandle(
      organizationId,
      handle,
    );
    if (!product) {
      throw new NotFoundException(`Producto "${handle}" no encontrado o no publicado.`);
    }
    return product;
  }

  // ── Helpers privados ──────────────────────────────────────────────────

  /**
   * Traduce un DomainError (de la capa domain, sin conocimiento de HTTP)
   * a la excepción HTTP apropiada de NestJS. Es la única función de este
   * service que "sabe" que domain y HTTP existen ambos — el punto de
   * traducción entre las dos capas.
   */
  private toHttpException(err: unknown): never {
    if (err instanceof DomainError) {
      throw new UnprocessableEntityException({
        code: err.code,
        message: err.message,
      });
    }
    throw err;
  }
}
