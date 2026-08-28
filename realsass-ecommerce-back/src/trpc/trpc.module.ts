/**
 * src/trpc/trpc.module.ts — realsass-ecommerce-back
 *
 * Auth flow admin (OWNER/COLLABORATOR):
 *   1. firebaseAuth     → verifica Bearer token → inyecta req.user + req.firebaseToken
 *   2. tenantContext    → llama OrganizationsClientService.getAccess(token, uid, orgId)
 *   3. trpcHandler      → adapter tRPC
 *
 * Auth flow clientes del storefront:
 *   - Sin Bearer token → firebaseAuth es no-op
 *   - x-customer-id header viene directo en el request
 *   - customerProcedure lo valida internamente
 */
import {
  Module,
  Injectable,
  type NestModule,
  type MiddlewareConsumer,
} from '@nestjs/common';
import { createExpressMiddleware }    from '@trpc/server/adapters/express';
import { createTrpcAuthMiddleware }   from '@real/auth-server';

import { createEcommerceAppRouter }   from './app-router';
import { createTrpcContext }          from './trpc';

import { CatalogService }             from '../catalog/catalog.service';
import { InventoryService }           from '../inventory/inventory.service';
import { OrdersService }              from '../orders/orders.service';
import { CustomersService }           from '../customers/customers.service';
import { CartService }                from '../cart/cart.service';
import { OrganizationsClientService } from '../organizations-client/organizations-client.service';

import { CatalogModule }              from '../catalog/catalog.module';
import { InventoryModule }            from '../inventory/inventory.module';
import { OrdersModule }               from '../orders/orders.module';
import { CustomersModule }            from '../customers/customers.module';
import { CartModule }                 from '../cart/cart.module';
import { OrganizationsClientModule }  from '../organizations-client/organizations-client.module';

@Injectable()
export class TrpcService {
  constructor(
    private readonly catalog:    CatalogService,
    private readonly inventory:  InventoryService,
    private readonly orders:     OrdersService,
    private readonly customers:  CustomersService,
    private readonly cart:       CartService,
    private readonly orgsClient: OrganizationsClientService,
  ) {}

  get handler() {
    const router = createEcommerceAppRouter({
      catalogService:   this.catalog,
      inventoryService: this.inventory,
      ordersService:    this.orders,
      customersService: this.customers,
      cartService:      this.cart,
    });

    return createExpressMiddleware({
      router,
      createContext: createTrpcContext,
    });
  }

  get authMiddleware() {
    return createTrpcAuthMiddleware({
      getOrganizationAccess: (token, uid, orgId) =>
        this.orgsClient.getAccess(token, uid, orgId),
    });
  }
}

@Module({
  imports: [
    CatalogModule,
    InventoryModule,
    OrdersModule,
    CustomersModule,
    CartModule,
    OrganizationsClientModule,
  ],
  providers: [TrpcService],
})
export class TrpcModule implements NestModule {
  constructor(private readonly trpcService: TrpcService) {}

  configure(consumer: MiddlewareConsumer): void {
    const { firebaseAuth, tenantContext } = this.trpcService.authMiddleware;

    consumer
      .apply(firebaseAuth, tenantContext, this.trpcService.handler)
      .forRoutes('/api/v1/trpc');
  }
}
