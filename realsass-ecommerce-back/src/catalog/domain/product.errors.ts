/**
 * domain/product.errors.ts
 *
 * Errores de dominio puros — NO extienden HttpException de NestJS.
 * La capa Application (catalog.service.ts) es responsable de traducirlos
 * a excepciones HTTP/tRPC apropiadas. El domain no sabe que existe HTTP.
 */

export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class InvalidHandleError extends DomainError {
  readonly code = 'INVALID_HANDLE';

  constructor(handle: string) {
    super(
      `El handle "${handle}" no es válido. Debe contener solo minúsculas, ` +
      `números y guiones, sin espacios ni caracteres especiales.`,
    );
  }
}

export class InvalidVariantPriceError extends DomainError {
  readonly code = 'INVALID_VARIANT_PRICE';

  constructor(priceCents: number) {
    super(`El precio de la variante debe ser mayor a 0. Recibido: ${priceCents}`);
  }
}

export class DuplicateSkuInProductError extends DomainError {
  readonly code = 'DUPLICATE_SKU_IN_PRODUCT';

  constructor(sku: string) {
    super(`El SKU "${sku}" está duplicado dentro del mismo producto.`);
  }
}

export class ProductWithoutVariantsError extends DomainError {
  readonly code = 'PRODUCT_WITHOUT_VARIANTS';

  constructor() {
    super('Un producto debe tener al menos una variante para poder crearse.');
  }
}

export class CannotPublishWithoutStockError extends DomainError {
  readonly code = 'CANNOT_PUBLISH_WITHOUT_STOCK';

  constructor(productId: string) {
    super(
      `El producto ${productId} no puede publicarse porque ninguna de sus ` +
      `variantes tiene stock disponible.`,
    );
  }
}
