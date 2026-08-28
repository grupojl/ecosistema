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

/** StoreInfo — shape público para el storefront */
export interface StoreInfo {
  organizationId:   string;
  slug:             string;
  name:             string | null;
  description:      string | null;
  logoUrl:          string | null;
  website:          string | null;
  ecommerceEnabled: boolean;
}
