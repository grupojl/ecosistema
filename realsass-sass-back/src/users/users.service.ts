import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService }        from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { OrganizationAccessResult } from '@real/auth-server';

const FULL_PERMISSIONS: Record<string, boolean> = {
  canViewListings: true, canCreateListings: true, canEditListings: true,
  canDeleteListings: true, canViewStats: true, canManageLeads: true,
  canManageCollaborators: true,
};

function parsePermissions(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'boolean')
      .map(([k, v]) => [k, v as boolean]),
  );
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgs:   OrganizationsService,
  ) {}

  async buildProfile(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        organization:  true,
        affiliateData: true,
        collaborations: {
          where:   { status: 'ACTIVE' },
          include: {
            organization: {
              select: {
                id: true, name: true, slug: true, logoUrl: true,
                description: true, website: true, phone: true, address: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const tenants = [];

    if (user.isOwner && user.organization) {
      tenants.push({
        organizationId: user.organization.id,
        organization:   user.organization,
        role:           'OWNER' as const,
        permissions:    FULL_PERMISSIONS,
      });
    }

    for (const collab of user.collaborations) {
      tenants.push({
        organizationId: collab.organizationId,
        organization:   collab.organization,
        role:           'COLLABORATOR' as const,
        permissions:    parsePermissions(collab.permissions),
      });
    }

    return {
      id:             user.id,
      firebaseUid:    user.firebaseUid,
      email:          user.email,
      displayName:    user.displayName,
      avatarUrl:      user.avatarUrl,
      isOwner:        user.isOwner,
      isAffiliate:    user.isAffiliate,
      affiliateCode:  user.affiliateCode,
      referredByCode: user.referredByCode,
      createdAt:      user.createdAt,
      updatedAt:      user.updatedAt,
      organization:   user.organization,
      tenants,
      affiliateData:  user.affiliateData
        ? {
            id:            user.affiliateData.id,
            balance:       user.affiliateData.balance.toString(),
            referralCount: user.affiliateData.referralCount,
            createdAt:     user.affiliateData.createdAt,
          }
        : null,
    };
  }

  async getMyProfile(firebaseUid: string) {
    const profile = await this.buildProfile(firebaseUid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llama a /auth/sync primero.');
    return profile;
  }

  async getOrganizationAccess(
    firebaseUid: string,
    o
# =============================================================================
# PASO 4 — realsass-ecommerce-back: usar @real/auth-server
# =============================================================================
sep
log "PASO 4 — Actualizando realsass-ecommerce-back..."

node -e "
const fs  = require('fs');
const p   = 'realsass-ecommerce-back/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@real/auth-server'] = 'workspace:*';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
console.log('[ok] @real/auth-server agregado a ecommerce-back');
"

cat > realsass-ecommerce-back/src/app.module.ts << 'EOF'
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
  FirebaseModule, FirebaseAuthGuard,
  CACHE_PORT, MemoryCacheAdapter,
} from '@real/auth-server';

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
    { provide: APP_GUARD,  useClass: ThrottlerGuard },
    { provide: CACHE_PORT, useClass: MemoryCacheAdapter },
  ],
})
export class AppModule {}
