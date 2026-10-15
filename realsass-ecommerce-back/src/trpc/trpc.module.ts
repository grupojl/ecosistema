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
 *   - cookie HttpOnly store_session: sesión firmada por el servidor (customer.identify). El contexto la
 *     verifica y de ahí sale el customerId; customerProcedure exige que exista y que sea de la misma tienda.
 *
 * Rate limit: ThrottlerGuard solo cubre controllers y /trpc es middleware, así que se limita acá.
 */
import {
  Module,
  Injectable,
  type NestModule,
  type MiddlewareConsumer,
} from '@nestjs/common';
import { createExpressMiddleware }    from '@trpc/server/adapters/express';
import { createRateLimitMiddleware, createTrpcAuthMiddleware, RedisRateLimitStore } from '@real/auth-server';
import { RedisService } from '@/redis/redis.service';

import { createEcommerceAppRouter }   from '@/trpc/app-router';
import { createTrpcContextFactory }   from '@/trpc/trpc';
import { IP_RATE_LIMIT, USER_RATE_LIMIT } from '@/trpc/rate-limit.config';
import { CustomerSessionService }     from '@/customers/customer-session.service';

import { CatalogService }             from '@/catalog/catalog.service';
import { InventoryService }           from '@/inventory/inventory.service';
import { OrdersService }              from '@/orders/orders.service';
import { CustomersService }           from '@/customers/customers.service';
import { CartService }                from '@/cart/cart.service';
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';

import { CatalogModule }              from '@/catalog/catalog.module';
import { InventoryModule }            from '@/inventory/inventory.module';
import { OrdersModule }               from '@/orders/orders.module';
import { CustomersModule }            from '@/customers/customers.module';
import { StoreService }              from '@/store/store.service';
import { StoreModule }               from '@/store/store.module';
import { CartModule }                 from '@/cart/cart.module';
import { OrganizationsClientModule }  from '@/organizations-client/organizations-client.module';

@Injectable()
export class TrpcService {
  constructor(
    private readonly catalog:    CatalogService,
    private readonly inventory:  InventoryService,
    private readonly orders:     OrdersService,
    private readonly customers:  CustomersService,
    private readonly cart:       CartService,
    private readonly store:      StoreService,
    private readonly orgsClient: OrganizationsClientService,
    private readonly customerSessions: CustomerSessionService,
  ) {}

  get handler() {
    const router = createEcommerceAppRouter({
      catalogService:   this.catalog,
      inventoryService: this.inventory,
      ordersService:    this.orders,
      customersService: this.customers,
      cartService:      this.cart,
      storeService:     this.store,
      customerSessions: this.customerSessions,
      storefrontGate:   this.orgsClient,
    });

    return createExpressMiddleware({
      router,
      createContext: createTrpcContextFactory(this.customerSessions),
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
    StoreModule,
    OrganizationsClientModule,
  ],
  providers: [TrpcService],
})
export class TrpcModule implements NestModule {
  constructor(
    private readonly trpcService: TrpcService,
    private readonly redis: RedisService,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    const { firebaseAuth, tenantContext } = this.trpcService.authMiddleware;

    // 1) por IP, ANTES de autenticar  2) por usuario (dashboard), DESPUÉS de autenticar
    // Contador en Redis (compartido entre réplicas); sin Redis cae a memoria por instancia.
    const store     = new RedisRateLimitStore(this.redis);
    const ipLimit   = createRateLimitMiddleware({ ...IP_RATE_LIMIT, store });
    const userLimit = createRateLimitMiddleware({ ...USER_RATE_LIMIT, store });

    consumer
      .apply(ipLimit, firebaseAuth, tenantContext, userLimit, this.trpcService.handler)
      // main.ts hace setGlobalPrefix('api/v1') y Nest lo antepone también a las rutas de middleware:
      // con '/api/v1/trpc' quedaba montado en /api/v1/api/v1/trpc y los fronts (que llaman a /api/v1/trpc) recibían 404.
      .forRoutes('/trpc');
  }
}
