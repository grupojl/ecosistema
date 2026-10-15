/**
 * src/trpc/app-router.ts — realsass-ecommerce-back
 *
 * Namespaces:
 *   adminCatalog.*   → catálogo admin (OWNER/COLLABORATOR)
 *   adminInventory.* → stock admin (OWNER/COLLABORATOR)
 *   adminOrders.*    → órdenes admin (OWNER/COLLABORATOR)
 *   customer.*       → cliente del storefront (público + autenticado)
 *
 * ADR-005: todo el consumo interno es tRPC.
 * REST solo para GET /health y futuros webhooks externos.
 */
import { router }                          from '@/trpc/trpc';
import { createAdminCatalogRouter }        from '@/trpc/routers/admin-catalog.router';
import { createAdminInventoryRouter }      from '@/trpc/routers/admin-inventory.router';
import { createAdminOrdersRouter }         from '@/trpc/routers/admin-orders.router';
import { createCustomerRouter }            from '@/trpc/routers/customer.router';

import type { CatalogService }             from '@/catalog/catalog.service';
import type { InventoryService }           from '@/inventory/inventory.service';
import type { OrdersService }              from '@/orders/orders.service';
import type { CustomersService }           from '@/customers/customers.service';
import type { CartService }                from '@/cart/cart.service';
import type { StoreService }               from '@/store/store.service';
import type { CustomerSessionService }     from '@/customers/customer-session.service';
import type { StorefrontGate }             from '@/trpc/routers/customer.router';

export interface EcommerceAppRouterDeps {
  catalogService:   CatalogService;
  inventoryService: InventoryService;
  ordersService:    OrdersService;
  customersService: CustomersService;
  cartService:      CartService;
  storeService:     StoreService;
  customerSessions: CustomerSessionService;
  storefrontGate:   StorefrontGate;
}

export function createEcommerceAppRouter(deps: EcommerceAppRouterDeps) {
  return router({
    adminCatalog:   createAdminCatalogRouter(deps.catalogService),
    adminInventory: createAdminInventoryRouter(deps.inventoryService),
    adminOrders:    createAdminOrdersRouter(deps.ordersService),
    customer:       createCustomerRouter(
      deps.customersService,
      deps.ordersService,
      deps.cartService,
      deps.catalogService,
      deps.storeService,
      deps.customerSessions,
      deps.storefrontGate,
    ),
  });
}

export type EcommerceAppRouter = ReturnType<typeof createEcommerceAppRouter>;
