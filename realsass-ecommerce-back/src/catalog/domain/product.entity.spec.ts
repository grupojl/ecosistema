/**
 * domain/product.entity.spec.ts
 *
 * Test de la capa Domain. CERO imports de @nestjs/* o @prisma/client.
 * No hay mocks porque no hay dependencias externas que mockear — el
 * domain es funciones puras sobre datos planos.
 */

import {
  assertValidHandle,
  assertValidVariantPrice,
  assertNoDuplicateSkus,
  assertHasAtLeastOneVariant,
  validateProductDraft,
  canPublish,
  type ProductDraft,
} from './product.entity';
import {
  InvalidHandleError,
  InvalidVariantPriceError,
  DuplicateSkuInProductError,
  ProductWithoutVariantsError,
} from './product.errors';

describe('domain/product.entity', () => {
  describe('assertValidHandle', () => {
    it('acepta handles slug-safe válidos', () => {
      expect(() => assertValidHandle('iphone-16-pro')).not.toThrow();
      expect(() => assertValidHandle('producto-123')).not.toThrow();
    });

    it('rechaza handles con espacios', () => {
      expect(() => assertValidHandle('iphone 16 pro')).toThrow(InvalidHandleError);
    });

    it('rechaza handles con mayúsculas', () => {
      expect(() => assertValidHandle('iPhone-16')).toThrow(InvalidHandleError);
    });

    it('rechaza handles con guiones dobles o al borde', () => {
      expect(() => assertValidHandle('-iphone')).toThrow(InvalidHandleError);
      expect(() => assertValidHandle('iphone-')).toThrow(InvalidHandleError);
    });
  });

  describe('assertValidVariantPrice', () => {
    it('acepta precios positivos enteros', () => {
      expect(() => assertValidVariantPrice(150000)).not.toThrow();
    });

    it('rechaza precio 0', () => {
      expect(() => assertValidVariantPrice(0)).toThrow(InvalidVariantPriceError);
    });

    it('rechaza precio negativo', () => {
      expect(() => assertValidVariantPrice(-100)).toThrow(InvalidVariantPriceError);
    });

    it('rechaza precio no entero (centavos de centavo no tienen sentido)', () => {
      expect(() => assertValidVariantPrice(100.5)).toThrow(InvalidVariantPriceError);
    });
  });

  describe('assertNoDuplicateSkus', () => {
    it('acepta SKUs únicos dentro del producto', () => {
      expect(() =>
        assertNoDuplicateSkus([
          { sku: 'SKU-1', title: 'Rojo', priceCents: 1000 },
          { sku: 'SKU-2', title: 'Azul', priceCents: 1000 },
        ]),
      ).not.toThrow();
    });

    it('rechaza SKUs duplicados dentro del mismo producto', () => {
      expect(() =>
        assertNoDuplicateSkus([
          { sku: 'SKU-1', title: 'Rojo', priceCents: 1000 },
          { sku: 'SKU-1', title: 'Azul', priceCents: 1000 },
        ]),
      ).toThrow(DuplicateSkuInProductError);
    });
  });

  describe('assertHasAtLeastOneVariant', () => {
    it('rechaza producto sin variantes', () => {
      expect(() => assertHasAtLeastOneVariant([])).toThrow(
        ProductWithoutVariantsError,
      );
    });

    it('acepta producto con al menos una variante', () => {
      expect(() =>
        assertHasAtLeastOneVariant([
          { sku: 'SKU-1', title: 'Único', priceCents: 1000 },
        ]),
      ).not.toThrow();
    });
  });

  describe('validateProductDraft (integración de invariantes)', () => {
    const validDraft: ProductDraft = {
      name: 'iPhone 16 Pro',
      handle: 'iphone-16-pro',
      variants: [
        { sku: 'IP16P-BLK-256', title: 'Negro 256GB', priceCents: 150000000 },
      ],
    };

    it('acepta un draft completamente válido', () => {
      expect(() => validateProductDraft(validDraft)).not.toThrow();
    });

    it('falla rápido en el primer error (handle inválido antes que precio)', () => {
      const invalidDraft: ProductDraft = {
        ...validDraft,
        handle: 'Handle Invalido',
        variants: [{ sku: 'X', title: 'X', priceCents: -1 }],
      };
      expect(() => validateProductDraft(invalidDraft)).toThrow(InvalidHandleError);
    });
  });

  describe('canPublish', () => {
    it('permite publicar si al menos una variante tiene stock', () => {
      expect(
        canPublish([{ quantityAvailable: 0 }, { quantityAvailable: 5 }]),
      ).toBe(true);
    });

    it('no permite publicar si ninguna variante tiene stock', () => {
      expect(
        canPublish([{ quantityAvailable: 0 }, { quantityAvailable: 0 }]),
      ).toBe(false);
    });

    it('no permite publicar un producto sin variantes', () => {
      expect(canPublish([])).toBe(false);
    });
  });
});
