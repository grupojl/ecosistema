/**
 * TenantRole — mismo union que @real/auth-server.
 * Copiado intencionalmente para no crear dependencia server en cliente.
 * Sprint 2: test de contrato verifica que ambos coinciden.
 */
export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface UserProfile {
  id:             string;
  firebaseUid:    string;
  email:          string;
  displayName:    string | null;
  avatarUrl:      string | null;
  isOwner:        boolean;
  isAffiliate:    boolean;
  affiliateCode:  string | null;
  createdAt:      string;
  updatedAt:      string;
  organization:   Organization | null;
  tenants:        Tenant[];
  affiliateData:  AffiliateData | null;
}

export interface Organization {
  id:          string;
  name:        string | null;
  slug:        string | null;
  description: string | null;
  logoUrl:     string | null;
  website:     string | null;
  phone:       string | null;
  address:     string | null;
}

export interface Tenant {
  organizationId: string;
  organization:   Organization;
  role:           TenantRole;
  permissions:    Record<string, boolean>;
}

export interface AffiliateData {
  id:            string;
  balance:       string;
  referralCount: number;
  createdAt:     string;
}

export interface ApiEnvelope<T> {
  success:  boolean;
  data:     T;
  message?: string;
}
