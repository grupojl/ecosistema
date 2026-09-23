/**
 * lib/catalog/product-view.ts — proyección de presentación del producto. PURO.
 *
 * Las páginas del storefront estaban escritas contra un shape inexistente
 * (p.slug, p.priceCents, p.imageUrls) — oculto por `ignoreBuildErrors`.
 * Consecuencias reales: precios "$NaN" y links a /productos/{uuid} → 404,
 * es decir: NINGÚN producto era indexable. Este módulo mapea el contrato
 * REAL de customer.getProducts (ProductRecord de ecommerce-back).
 *
 * `ProductLike` es estructural: StoreProduct (inferRouterOutputs) es
 * asignable sin casts. Sin superjson, las fechas llegan como string ISO.
 */
export interface VariantLike {
  id:         string;
  title:      string;
  priceCents: number;
  currency:   string;
  inventory:  { quantityAvailable: number; quantityReserved: number } | null;
}

export interface ProductLike {
  id:          string;
  name:        string;
  handle:      string;
  description: string | null;
  updatedAt:   Date | string;
  category:    { id: string; name: string; handle: string } | null;
  variants:    readonly VariantLike[];
}

export interface VariantView {
  id:         string;
  title:      string;
  priceCents: number;
  available:  boolean;
}

export interface ProductView {
  id:            string;
  handle:        string;
  name:          string;
  description:   string | null;
  category:      { name: string; handle: string } | null;
  currency:      string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  inStock:       boolean;
  variants:      VariantView[];
  updatedAt:     Date;
}

export function availableUnits(inventory: VariantLike['inventory']): number {
  if (!inventory) return 0;
  return Math.max(0, inventory.quantityAvailable - inventory.quantityReserved);
}

function toDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function toProductView(product: ProductLike): ProductView {
  const variants: VariantView[] = product.variants.map((v) => ({
    id:         v.id,
    title:      v.title,
    priceCents: v.priceCents,
    available:  availableUnits(v.inventory) > 0,
  }));

  // Rango de precio solo sobre la moneda de la primera variante: mezclar
  // monedas en un min/max sería un dato falso (y Google lo penaliza en rich results).
  const currency = product.variants[0]?.currency ?? null;
  const prices = product.variants
    .filter((v) => v.currency === currency)
    .map((v) => v.priceCents);

  return {
    id:            product.id,
    handle:        product.handle,
    name:          product.name,
    description:   product.description,
    category:      product.category ? { name: product.category.name, handle: product.category.handle } : null,
    currency,
    minPriceCents: prices.length > 0 ? Math.min(...prices) : null,
    maxPriceCents: prices.length > 0 ? Math.max(...prices) : null,
    inStock:       variants.some((v) => v.available),
    variants,
    updatedAt:     toDate(product.updatedAt),
  };
}

/** Formatea centavos. Moneda inválida no rompe el render (RangeError de Intl). */
export function formatPrice(priceCents: number, currency: string, intlLocaleTag: string): string {
  const amount = priceCents / 100;
  try {
    return new Intl.NumberFormat(intlLocaleTag, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export interface Page<T> {
  items:      T[];
  page:       number;
  totalPages: number;
  total:      number;
}

/** Paginación. page fuera de rango → null (la página debe responder 404, no soft-404). */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> | null {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (!Number.isInteger(page) || page < 1 || page > totalPages) return null;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, totalPages, total };
}

/** "?page=abc" | "?page=0" | "?page=1.5" → NaN → 404 en la página. "" → 1. */
export function parsePageParam(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 1;
  return /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
}
