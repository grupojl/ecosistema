import { Module }                     from '@nestjs/common';
import { APP_GUARD }                  from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule }               from '@nestjs/config';

import { PrismaModule }              from './prisma/prisma.module';
import { RedisModule }               from './redis/redis.module';
import { OrganizationsClientModule } from './organizations-client/organizations-client.module';
import { CatalogModule }             from './catalog/catalog.module';
import { InventoryModule }           from './inventory/inventory.module';
import { CustomersModule }           from './customers/customers.module';
import { ActivityModule }            from './activity/activity.module';
import { CartModule }                from './cart/cart.module';
import { OrdersModule }              from './orders/orders.module';
import { StoreModule }               from './store/store.module';
import { TrpcModule }                from './trpc/trpc.module';

import {
  FirebaseModule,
  FirebaseAuthGuard,
  TenantGuard,
  RolesGuard,
  CACHE_PORT,
  MemoryCacheAdapter,
} from '@real/auth-server';

/**
 * Orden de APP_GUARD importa:
 *   1. FirebaseAuthGuard — verifica identidad (quien sos)
 *   2. TenantGuard       — resuelve organizacion y rol
 *   3. RolesGuard        — aplica RBAC
 *   4. ThrottlerGuard    — rate limiting
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
    FirebaseModule,
    PrismaModule,
    RedisModule,
    OrganizationsClientModule,
    CatalogModule,
    InventoryModule,
    CustomersModule,
    ActivityModule,
    CartModule,
    OrdersModule,
    StoreModule,
    TrpcModule,
  ],
  providers: [
    { provide: APP_GUARD,  useClass: FirebaseAuthGuard },
    { provide: APP_GUARD,  useClass: TenantGuard },
    { provide: APP_GUARD,  useClass: RolesGuard },
    { provide: APP_GUARD,  useClass: ThrottlerGuard },
    { provide: CACHE_PORT, useClass: MemoryCacheAdapter },
  ],
})
export class AppModule {}
