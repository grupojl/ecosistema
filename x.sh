#!/usr/bin/env bash
# =============================================================================
# x.sh — fix rutas dashboard-front → ecommerce-back
#
# Problema: features/store/api.ts llama a /ecommerce/catalog/admin*
#           pero el CatalogController está montado en /ecommerce/products
#
# Rutas reales en realsass-ecommerce-back:
#   GET    /api/v1/ecommerce/products          → list (con TenantGuard)
#   POST   /api/v1/ecommerce/products          → create
#   PATCH  /api/v1/ecommerce/products/:id      → update
#   GET    /api/v1/ecommerce/orders            → list (OrdersController)
#   GET    /api/v1/ecommerce/orders/:id        → get
#   PATCH  /api/v1/ecommerce/inventory/:id     → setStock (ya correcto)
#
# Archivo tocado: realsass-dashboard-front/features/store/api.ts (solo este)
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${YELLOW}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

TARGET="realsass-dashboard-front/features/store/api.ts"

[ -f "$TARGET" ] || fail "No se encontró $TARGET — correr desde la raíz del monorepo"

log "Sobreescribiendo $TARGET con rutas correctas..."

cat > "$TARGET" << 'EOF'
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
EOF

ok "$TARGET corregido"

echo ""
echo "  Cambios aplicados:"
echo "  • realsass-dashboard-front/features/store/api.ts"
echo "      /ecommerce/catalog/admin   →  /ecommerce/products"
echo "      /ecommerce/catalog/admin/:id →  /ecommerce/products/:id"
echo "      POST /ecommerce/catalog/admin → POST /ecommerce/products"
echo "      PATCH /ecommerce/catalog/admin/:id → PATCH /ecommerce/products/:id"
echo "      deleteProduct comentado (el back no tiene @Delete todavía)"
echo ""
echo "  ⚠  VERIFICAR en Railway (realsass-ecommerce-back → Variables):"
echo "     ORGANIZATIONS_SERVICE_URL debe apuntar a realsass-sass-back"
echo "     sin trailing slash, ej: https://org-back.up.railway.app"
echo ""
echo "  ⚠  VERIFICAR en Railway (realsass-dashboard-front → Variables):"
echo "     NEXT_PUBLIC_ECOMMERCE_API_URL debe incluir /api/v1"
echo "     ej: https://ecommerce-back.up.railway.app/api/v1"
echo ""
echo "  Después de este fix, los 404 desaparecen."
echo "  Si el 401 persiste → el problema es ORGANIZATIONS_SERVICE_URL en ecommerce-back."