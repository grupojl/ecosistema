// features/store/api.ts
// Consume realsass-ecommerce-back vía ecommerceFetch.
//
// Rutas reales del backend (CatalogController → @Controller('ecommerce/products')):
//   GET    /ecommerce/products        → list admin
//   GET    /ecommerce/products/:id    → get one
//   POST   /ecommerce/products        → create
//   PATCH  /ecommerce/products/:id    → update
//   (delete no existe en el controller actual — ver nota abajo)
//
//   GET    /ecommerce/inventory/:variantId → get stock
//   PATCH  /ecommerce/inventory/:variantId → set stock
//
//   GET    /ecommerce/orders          → list
//   GET    /ecommerce/orders/:id      → get one

import { ecommerceFetch, buildQuery } from '@/lib/api-client';
import type {
  Product, ProductInput, ProductFilters,
  Order, OrderFilters, Paginated,
} from './types';

export const storeApi = {
  // ─── Catálogo (admin) ───────────────────────────────────────────────────────

  /** GET /ecommerce/products?search=&page=&limit= */
  getProducts: (orgId: string, filters: ProductFilters = {}) =>
    ecommerceFetch.get<Paginated<Product>>(
      `/ecommerce/products${buildQuery(filters as Record<string, unknown>)}`,
      orgId,
    ),

  /** GET /ecommerce/products/:id */
  getProduct: (orgId: string, id: string) =>
    ecommerceFetch.get<Product>(`/ecommerce/products/${id}`, orgId),

  /** POST /ecommerce/products */
  createProduct: (orgId: string, data: ProductInput) =>
    ecommerceFetch.post<Product>('/ecommerce/products', data, orgId),

  /** PATCH /ecommerce/products/:id */
  updateProduct: (orgId: string, id: string, data: Partial<ProductInput>) =>
    ecommerceFetch.patch<Product>(`/ecommerce/products/${id}`, data, orgId),

  // NOTA: el CatalogController actual no tiene @Delete — si necesitás borrar
  // productos usá isActive: false via updateProduct (soft-delete).
  // Cuando el endpoint exista en el back, descomentar:
  // deleteProduct: (orgId: string, id: string) =>
  //   ecommerceFetch.delete<{ message: string }>(`/ecommerce/products/${id}`, orgId),

  // ─── Inventario ─────────────────────────────────────────────────────────────

  /** PATCH /ecommerce/inventory/:variantId */
  updateInventory: (orgId: string, variantId: string, quantityAvailable: number) =>
    ecommerceFetch.patch<{ message: string }>(
      `/ecommerce/inventory/${variantId}`,
      { quantityAvailable },
      orgId,
    ),

  // ─── Pedidos ────────────────────────────────────────────────────────────────

  /** GET /ecommerce/orders?status=&page=&limit= */
  getOrders: (orgId: string, filters: OrderFilters = {}) =>
    ecommerceFetch.get<Paginated<Order>>(
      `/ecommerce/orders${buildQuery(filters as Record<string, unknown>)}`,
      orgId,
    ),

  /** GET /ecommerce/orders/:id */
  getOrder: (orgId: string, id: string) =>
    ecommerceFetch.get<Order>(`/ecommerce/orders/${id}`, orgId),
};
