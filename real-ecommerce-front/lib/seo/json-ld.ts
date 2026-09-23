/**
 * lib/seo/json-ld.ts — datos estructurados schema.org. PURO.
 * Rich results: precio y stock en Google Shopping / resultados orgánicos.
 */
import type { ProductView } from '@/lib/catalog/product-view';

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];
export interface JsonLdObject {
  [key: string]: JsonLdValue | undefined;
}

const SCHEMA = 'https://schema.org';

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface StoreJsonLdInput {
  name:        string;
  url:         string;
  description: string | null;
  logoUrl:     string | null;
  website:     string | null;
}

export function storeJsonLd(input: StoreJsonLdInput): JsonLdObject {
  return {
    '@context':  SCHEMA,
    '@type':     'OnlineStore',
    name:        input.name,
    url:         input.url,
    description: input.description ?? undefined,
    logo:        input.logoUrl ?? undefined,
    sameAs:      input.website ? [input.website] : undefined,
  };
}

export interface ProductJsonLdInput {
  product:   ProductView;
  url:       string;
  storeName: string;
  inLanguage: string;
}

export function productJsonLd({ product, url, storeName, inLanguage }: ProductJsonLdInput): JsonLdObject {
  const availability = product.inStock ? `${SCHEMA}/InStock` : `${SCHEMA}/OutOfStock`;
  const seller: JsonLdObject = { '@type': 'Organization', name: storeName };

  let offers: JsonLdObject | undefined;
  if (product.currency && product.minPriceCents !== null && product.maxPriceCents !== null) {
    offers = product.minPriceCents === product.maxPriceCents
      ? {
          '@type':       'Offer',
          url,
          price:         centsToDecimal(product.minPriceCents),
          priceCurrency: product.currency,
          availability,
          seller,
        }
      : {
          '@type':       'AggregateOffer',
          url,
          lowPrice:      centsToDecimal(product.minPriceCents),
          highPrice:     centsToDecimal(product.maxPriceCents),
          offerCount:    product.variants.length,
          priceCurrency: product.currency,
          availability,
          seller,
        };
  }

  return {
    '@context':  SCHEMA,
    '@type':     'Product',
    '@id':       `${url}#product`,
    name:        product.name,
    description: product.description ?? undefined,
    sku:         product.handle,
    url,
    inLanguage,
    category:    product.category?.name,
    offers,
  };
}

export interface BreadcrumbItem {
  name: string;
  url:  string;
}

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLdObject {
  return {
    '@context': SCHEMA,
    '@type':    'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type':  'ListItem',
      position: index + 1,
      name:     item.name,
      item:     item.url,
    })),
  };
}

/**
 * Serialización segura para <script type="application/ld+json">.
 * Nombre de producto = input del TENANT: un "</script><script>…" en el
 * nombre sería XSS almacenado en todas las tiendas. Se escapan <, >, &
 * y los separadores de línea U+2028/2029.
 */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
