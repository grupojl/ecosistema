/**
 * organization.entity.ts — dominio puro
 * Sin imports de NestJS ni Prisma.
 */

export interface Organization {
  id:               string;
  firebaseUid:      string;
  slug:             string | null;
  name:             string | null;
  description:      string | null;
  logoUrl:          string | null;
  website:          string | null;
  enabledProducts:  Record<string, unknown>;
  plan:             string;
  createdAt:        Date;
  updatedAt:        Date;
}

export interface UpdateOrganizationInput {
  name?:        string;
  description?: string;
  logoUrl?:     string;
  website?:     string;
  slug?:        string;
}

export interface CreateOrganizationInput {
  userId:      string;
  firebaseUid: string;
}

/** Espejo de enum StoreStatus (schema.prisma) — el dominio no importa Prisma. */
export type StoreStatusValue = 'ACTIVE' | 'PAUSED';

/**
 * StoreInfo — shape público para el storefront.
 *
 * ADR-016: `countryCode` se expone para que el storefront derive el idioma
 * primario indexable de la tienda (SEO) y el formato regional de precios.
 * Cambio ADITIVO del contrato — consumidores viejos lo ignoran.
 */
export interface StoreInfo {
  organizationId:   string;
  slug:             string;
  name:             string | null;
  description:      string | null;
  logoUrl:          string | null;
  website:          string | null;
  countryCode:      string;   // ISO 3166-1 alpha-2, UPPERCASE
  ecommerceEnabled: boolean;
}

/** Fila mínima necesaria para construir el StoreInfo público. */
export interface PublicStoreRow {
  id:          string;
  slug:        string | null;
  name:        string | null;
  description: string | null;
  logoUrl:     string | null;
  website:     string | null;
  countryCode: string;
  storeStatus: StoreStatusValue;
}

const ISO_ALPHA2 = /^[A-Z]{2}$/;
export const DEFAULT_ORGANIZATION_COUNTRY = 'AR';

/**
 * Invariantes del StoreInfo público:
 *   - Sin slug no hay tienda pública (null).
 *   - ecommerceEnabled depende SOLO de storeStatus (ADR-013).
 *   - countryCode siempre válido: dato corrupto → país default, nunca 500.
 */
export function toPublicStoreInfo(row: PublicStoreRow): StoreInfo | null {
  if (!row.slug) return null;

  const normalizedCountry = row.countryCode.trim().toUpperCase();

  return {
    organizationId:   row.id,
    slug:             row.slug,
    name:             row.name,
    description:      row.description,
    logoUrl:          row.logoUrl,
    website:          row.website,
    countryCode:      ISO_ALPHA2.test(normalizedCountry) ? normalizedCountry : DEFAULT_ORGANIZATION_COUNTRY,
    ecommerceEnabled: row.storeStatus === 'ACTIVE',
  };
}
