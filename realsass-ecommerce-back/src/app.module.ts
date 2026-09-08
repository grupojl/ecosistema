import { Module }              from '@nestjs/common';
import { ConfigModule }        from '@nestjs/config';
import { APP_GUARD }           from '@nestjs/core';

import { PrismaModule }        from './prisma/prisma.module';
import { RedisModule }         from './redis/redis.module';
import { HealthModule }        from './health/health.module';
import { ActivityModule }      from './activity/activity.module';
import { CatalogModule }       from './catalog/catalog.module';
import { CartModule }          from './cart/cart.module';
import { CustomersModule }     from './customers/customers.module';
import { InventoryModule }     from './inventory/inventory.module';
import { OrdersModule }        from './orders/orders.module';
import { StoreModule }         from './store/store.module';
import { OrganizationsClientModule } from './organizations-client/organizations-client.module';
import { TrpcModule }          from './trpc/trpc.module';

import {
  FirebaseModule,
  FirebaseAuthGuard,
  TenantGuard,
  RolesGuard,
  CACHE_PORT,
  MemoryCacheAdapter,
} from '@real/auth-server';

/**
 * app.module.ts — realsass-ecommerce-back
 *
 * ADR-005: Sin controllers REST legacy.
 * Toda la superficie HTTP pasa por TrpcModule (4 routers).
 * Los módulos de dominio solo exponen Services al TrpcModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    HealthModule,
    FirebaseModule,
    OrganizationsClientModule,
    ActivityModule,
    CatalogModule,
    CartModule,
    CustomersModule,
    InventoryModule,
    OrdersModule,
    StoreModule,
    TrpcModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: CACHE_PORT, useClass: MemoryCacheAdapter },
  ],
})
export class AppModule {}
