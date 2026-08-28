/**
 * domain/product.entity.ts
 *
 * Reglas de negocio PURAS del bounded context "catalog".
 * Cero imports de @nestjs/*, @prisma/client o cualquier infraestructura.
 * Esto es lo que se testea "sin mockear nada" — ver product.entity.spec.ts.
 *
 * Responsabilidad: invariantes de Product/Variant que deben cumplirse
 * SIEMPRE, sin importar si el dato viene de un DTO, un import masivo, o
 * un test. La capa Application (catalog.service.ts) llama estas funciones
 * antes de pedirle al Repository que persista.
 */

import {
  InvalidHandleError,
  InvalidVariantPriceError,
  DuplicateSkuInProductError,
  ProductWithoutVariantsError,
} from './product.errors';

// ─── Value objects / shapes de dominio ───────────────────────────────────────

const HANDLE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ProductVariantDraft {
  sku: string;
  title: string;
  priceCents: number;
  currency?: string;
}

export interface ProductDraft {
  name: string;
  handle: string;
  description?: string;
  categoryId?: string;
  variants: ProductVariantDraft[];
}

// ─── Invariantes ──────────────────────────────────────────────────────────────

/**
 * Un handle es la parte de la URL que identifica al producto dentro de la
 * organización (ej. "iphone-16-pro"). Debe ser slug-safe.
 */
export function assertValidHandle(handle: string): void {
  if (!HANDLE_REGEX.test(handle)) {
    throw new InvalidHandleError(handle);
  }
}

/**
 * El precio se maneja en centavos como entero (evita errores de punto
 * flotante). Debe ser estrictamente positivo — precio 0 no es un producto
 * gratis válido en este dominio, es un dato mal cargado.
 */
export function assertValidVariantPrice(priceCents: number): void {
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new InvalidVariantPriceError(priceCents);
  }
}

/**
 * Dentro de un mismo producto, los SKUs de sus variantes no pueden repetirse
 * (sí pueden repetirse entre productos distintos — el unique real de SKU es
 * a nivel organización y lo garantiza el constraint de Prisma
 * @@unique([organizationId, sku]), esto es una validación temprana de
 * dominio antes de pagar el costo de un roundtrip a la DB).
 */
export function assertNoDuplicateSkus(variants: ProductVariantDraft[]): void {
  const seen = new Set<string>();
  for (const variant of variants) {
    if (seen.has(variant.sku)) {
      throw new DuplicateSkuInProductError(variant.sku);
    }
    seen.add(variant.sku);
  }
}

/**
 * Un producto sin variantes no es vendible — no tiene sentido que exista
 * en el catálogo. Esto es una decisión de negocio, no una restricción
 * técnica de la DB (la FK permite productos sin variantes).
 */
export function assertHasAtLeastOneVariant(variants: ProductVariantDraft[]): void {
  if (variants.length === 0) {
    throw new ProductWithoutVariantsError();
  }
}

/**
 * Valida un ProductDraft completo aplicando todas las invariantes del
 * dominio. Este es el punto de entrada que usa la capa Application.
 * Lanza el primer DomainError que encuentre (fail-fast).
 */
export function validateProductDraft(draft: ProductDraft): void {
  assertValidHandle(draft.handle);
  assertHasAtLeastOneVariant(draft.variants);
  assertNoDuplicateSkus(draft.variants);

  for (const variant of draft.variants) {
    assertValidVariantPrice(variant.priceCents);
  }
}

/**
 * Determina si un producto puede pasar a estado PUBLISHED.
 * Regla de negocio: al menos una variante debe tener stock disponible > 0.
 * Es una función pura — recibe los datos ya resueltos, no consulta nada.
 */
export function canPublish(
  variantsWithStock: Array<{ quantityAvailable: number }>,
): boolean {
  return variantsWithStock.some((v) => v.quantityAvailable > 0);
}
