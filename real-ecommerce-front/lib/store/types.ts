// lib/store/types.ts
// Tipos del storefront multi-tenant.
// StoreInfo es lo que devuelve GET /ecommerce/public/by-slug/:slug

export interface StoreInfo {
  organizationId: string
  slug: string
  name: string | null
  description: string | null
  logoUrl: string | null
  website: string | null
  ecommerceEnabled: boolean
}

export interface StoreProduct {
  id: string
  name: string
  slug: string
  description: string | null
  priceCents: number
  currency: string
  imageUrls: string[]
  category?: { id: string; handle: string; name: string } | null
  variants?: Array<{ id: string; sku: string; name: string; priceCents: number; stock: number }>
}

export interface StoreCategory {
  id: string
  handle: string
  name: string
  description: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}
