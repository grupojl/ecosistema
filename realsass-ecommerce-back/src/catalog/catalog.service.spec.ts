/**
 * catalog.service.spec.ts
 *
 * Test de la capa Application. Mockea el CatalogRepository (interfaz),
 * NO PrismaService. Esto es lo que gana la capa Repository: el Service
 * se testea sin levantar Postgres ni conocer Prisma.
 */

import { Test } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
  type ProductRecord,
} from './repository/catalog.repository.interface';

function makeMockRepository(): jest.Mocked<CatalogRepository> {
  return {
    existsByHandle: jest.fn(),
    createProduct: jest.fn(),
    findByIdAdmin: jest.fn(),
    listAdmin: jest.fn(),
    updateProduct: jest.fn(),
    listPublished: jest.fn(),
    findPublishedByHandle: jest.fn(),
  };
}

const ORG_ID = 'org-123';

function fakeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: 'prod-1',
    organizationId: ORG_ID,
    categoryId: null,
    name: 'iPhone 16 Pro',
    handle: 'iphone-16-pro',
    description: null,
    status: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
    category: null,
    variants: [],
    ...overrides,
  };
}

describe('CatalogService (application layer)', () => {
  let service: CatalogService;
  let repository: jest.Mocked<CatalogRepository>;

  beforeEach(async () => {
    repository = makeMockRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: CATALOG_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(CatalogService);
  });

  describe('createProduct', () => {
    const validDto = {
      name: 'iPhone 16 Pro',
      handle: 'iphone-16-pro',
      variants: [
        { sku: 'IP16P-256', title: '256GB', priceCents: 150000000 },
      ],
    } as any;

    it('crea el producto si el draft es válido y el handle no existe', async () => {
      repository.existsByHandle.mockResolvedValue(false);
      repository.createProduct.mockResolvedValue(fakeProduct());

      const result = await service.createProduct(ORG_ID, validDto);

      expect(repository.existsByHandle).toHaveBeenCalledWith(ORG_ID, 'iphone-16-pro');
      expect(repository.createProduct).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({ handle: 'iphone-16-pro' }),
      );
      expect(result.handle).toBe('iphone-16-pro');
    });

    it('rechaza con ConflictException si el handle ya existe (sin llegar a Prisma)', async () => {
      repository.existsByHandle.mockResolvedValue(true);

      await expect(service.createProduct(ORG_ID, validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.createProduct).not.toHaveBeenCalled();
    });

    it('rechaza con UnprocessableEntityException si el domain invalida el draft', async () => {
      const invalidDto = { ...validDto, handle: 'Handle Invalido!!' };

      await expect(service.createProduct(ORG_ID, invalidDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      // Nunca debería consultar el repository si el domain ya rechazó.
      expect(repository.existsByHandle).not.toHaveBeenCalled();
    });
  });

  describe('updateProduct', () => {
    it('rechaza con NotFoundException si el producto no existe', async () => {
      repository.findByIdAdmin.mockResolvedValue(null);

      await expect(
        service.updateProduct(ORG_ID, 'prod-inexistente', { status: 'PUBLISHED' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza publicar si ninguna variante tiene stock', async () => {
      repository.findByIdAdmin.mockResolvedValue(
        fakeProduct({
          variants: [
            {
              id: 'v1',
              productId: 'prod-1',
              sku: 'SKU-1',
              title: 'Único',
              priceCents: 1000,
              currency: 'USD',
              inventory: { quantityAvailable: 0, quantityReserved: 0 },
            },
          ],
        }),
      );

      await expect(
        service.updateProduct(ORG_ID, 'prod-1', { status: 'PUBLISHED' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(repository.updateProduct).not.toHaveBeenCalled();
    });

    it('permite publicar si al menos una variante tiene stock', async () => {
      repository.findByIdAdmin.mockResolvedValue(
        fakeProduct({
          variants: [
            {
              id: 'v1',
              productId: 'prod-1',
              sku: 'SKU-1',
              title: 'Único',
              priceCents: 1000,
              currency: 'USD',
              inventory: { quantityAvailable: 3, quantityReserved: 0 },
            },
          ],
        }),
      );
      repository.updateProduct.mockResolvedValue(
        fakeProduct({ status: 'PUBLISHED' }),
      );

      const result = await service.updateProduct(ORG_ID, 'prod-1', {
        status: 'PUBLISHED',
      } as any);

      expect(result.status).toBe('PUBLISHED');
    });
  });

  describe('getProductPublic', () => {
    it('lanza NotFoundException si no está publicado o no existe', async () => {
      repository.findPublishedByHandle.mockResolvedValue(null);

      await expect(
        service.getProductPublic(ORG_ID, 'no-existe'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devuelve el producto si está publicado', async () => {
      repository.findPublishedByHandle.mockResolvedValue(
        fakeProduct({ status: 'PUBLISHED' }),
      );

      const result = await service.getProductPublic(ORG_ID, 'iphone-16-pro');
      expect(result.status).toBe('PUBLISHED');
    });
  });
});
