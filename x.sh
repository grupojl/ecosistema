#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 2: Errores de build ronda 2
#
# Corre desde la raiz del monorepo (donde esta pnpm-workspace.yaml)
#
# QUE CORRIGE:
#   1. sass-back app.module.ts: aun importa FirebaseAuthGuard de ./common/guards/
#   2. sass-back + ecommerce-back: @Roles('COLLABORATOR') — no existe en TenantRole
#      TenantRole = 'OWNER'|'ADMIN'|'MEMBER'|'VIEWER' → COLLABORATOR era el viejo
#   3. sass-back users.service.ts: llama ensureOrganization que no existe en
#      OrganizationsService → el metodo correcto es createForUser()
#   4. ecommerce-back firebase.module.ts: @nestjs/config no esta en peer deps
#      de auth-server → agregar ConfigModule o usar process.env directo
#   5. ecommerce-back organizations-client/types: importa CollaboratorPermissions
#      que no existe en @real/auth-server → usar Record<string, boolean>
# =============================================================================

set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${BLUE}[->]${NC} $1"; }
ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
sep()  { echo -e "${BOLD}----------------------------------------------------${NC}"; }

if [ ! -f "pnpm-workspace.yaml" ]; then
  echo "Corre desde la raiz del monorepo"; exit 1
fi

sep
echo -e "${BOLD}  FIX 2 — Errores de build ronda 2${NC}"
sep

# =============================================================================
# FIX 1 — sass-back app.module.ts: import de FirebaseAuthGuard local
# El sed anterior no lo alcanzo porque el import usa ruta './common/...' (sin ../)
# =============================================================================
log "FIX 1 — app.module.ts de sass-back: corrigiendo import local de FirebaseAuthGuard..."

cat > realsass-sass-back/src/app.module.ts << 'EOF'
import { Module }                     from '@nestjs/common';
import { ConfigModule }               from '@nestjs/config';
import { APP_GUARD }                  from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule }         from '@nestjs/event-emitter';

import { HealthModule }          from './health/health.module';
import { PrismaModule }          from './prisma/prisma.module';
import { RedisModule }           from './redis/redis.module';
import { AuthModule }            from './auth/auth.module';
import { UsersModule }           from './users/users.module';
import { OrganizationsModule }   from './organizations/organizations.module';
import { AffiliatesModule }      from './affiliate/affiliate.module';
import { CollaboratorsModule }   from './collaborators/collaborators.module';
import { ConfigCacheModule }     from './config-cache/config-cache.module';
import { ConfigAuditModule }     from './config-audit/config-audit.module';
import { ConfigThemesModule }    from './config-themes/config-themes.module';
import { ConfigFlagsModule }     from './config-flags/config-flags.module';
import { ConfigSecretsModule }   from './config-secrets/config-secrets.module';
import { ConfigTemplatesModule } from './config-templates/config-templates.module';
import { ConfigQuotasModule }    from './config-quotas/config-quotas.module';
import { ConfigWebhooksModule }  from './config-webhooks/config-webhooks.module';
import { TrpcModule }            from './trpc/trpc.module';

import {
  FirebaseModule,
  FirebaseAuthGuard,
  CACHE_PORT,
  MemoryCacheAdapter,
} from '@real/auth-server';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
    EventEmitterModule.forRoot({ wildcard: false }),
    FirebaseModule,
    HealthModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AffiliatesModule,
    CollaboratorsModule,
    ConfigCacheModule,
    ConfigAuditModule,
    ConfigThemesModule,
    ConfigFlagsModule,
    ConfigSecretsModule,
    ConfigTemplatesModule,
    ConfigQuotasModule,
    ConfigWebhooksModule,
    TrpcModule,
  ],
  providers: [
    { provide: APP_GUARD,  useClass: FirebaseAuthGuard },
    { provide: APP_GUARD,  useClass: ThrottlerGuard },
    { provide: CACHE_PORT, useClass: MemoryCacheAdapter },
  ],
})
export class AppModule {}
EOF
ok "sass-back/src/app.module.ts"

# =============================================================================
# FIX 2 — TenantRole: reemplazar 'COLLABORATOR' por 'MEMBER' en ambos backs
#
# El rol viejo era OWNER | COLLABORATOR (sistema propio).
# El nuevo TenantRole en @real/auth-server es OWNER | ADMIN | MEMBER | VIEWER.
# Los controllers que usaban 'COLLABORATOR' deben usar 'MEMBER'.
# =============================================================================
sep
log "FIX 2 — Reemplazando COLLABORATOR por MEMBER en @Roles() de ambos backs..."

# sass-back
find realsass-sass-back/src -name "*.ts" -exec \
  sed -i "s/@Roles('OWNER', 'COLLABORATOR')/@Roles('OWNER', 'MEMBER')/g" {} \;
find realsass-sass-back/src -name "*.ts" -exec \
  sed -i "s/@Roles('COLLABORATOR')/@Roles('MEMBER')/g" {} \;

# ecommerce-back
find realsass-ecommerce-back/src -name "*.ts" -exec \
  sed -i "s/@Roles('OWNER', 'COLLABORATOR')/@Roles('OWNER', 'MEMBER')/g" {} \;
find realsass-ecommerce-back/src -name "*.ts" -exec \
  sed -i "s/@Roles('COLLABORATOR')/@Roles('MEMBER')/g" {} \;

ok "COLLABORATOR -> MEMBER en @Roles()"

# =============================================================================
# FIX 3 — users.service.ts: ensureOrganization no existe
# OrganizationsService tiene createForUser(userId) — ese es el metodo correcto
# =============================================================================
sep
log "FIX 3 — users.service.ts: ensureOrganization -> createForUser..."

sed -i "s/await this\.orgs\.ensureOrganization(user\.id)/await this.orgs.createForUser(user.id)/g" \
  realsass-sass-back/src/users/users.service.ts

ok "users.service.ts: ensureOrganization -> createForUser"

# =============================================================================
# FIX 4 — @real/auth-server/firebase.module.ts: @nestjs/config no disponible
# en ecommerce-back via el paquete. Solucion: usar process.env directamente
# en el FirebaseModule, sin depender de ConfigService.
# Esto elimina la dependencia de @nestjs/config en el paquete auth-server.
# =============================================================================
sep
log "FIX 4 — firebase.module.ts: reemplazar ConfigService por process.env..."

cat > packages/auth-server/src/firebase/firebase.module.ts << 'EOF'
import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * FirebaseModule — inicializa Firebase Admin SDK UNA sola vez.
 * @Global() — disponible en toda la app sin importarlo en cada modulo.
 *
 * Lee directamente de process.env para no depender de @nestjs/config,
 * lo que permite que el paquete funcione en cualquier app NestJS sin
 * requerir ConfigModule como dependencia transitiva.
 *
 * Variables de entorno requeridas:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (con \\n escapados del .env)
 */
@Global()
@Module({})
export class FirebaseModule implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModule.name);

  onModuleInit(): void {
    if (admin.apps.length > 0) return;

    const projectId   = process.env['FIREBASE_PROJECT_ID'];
    const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
    const privateKey  = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');

    if (!projectId) {
      this.logger.warn('FIREBASE_PROJECT_ID no configurado — FirebaseModule deshabilitado');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase Admin inicializado: ${projectId}`);
  }
}
EOF
ok "packages/auth-server/src/firebase/firebase.module.ts"

# Remover @nestjs/config de las dependencias del paquete auth-server
# ya que no lo necesitamos mas
node -e "
const fs  = require('fs');
const p   = 'packages/auth-server/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
delete pkg.dependencies['@nestjs/config'];
if (pkg.peerDependencies) delete pkg.peerDependencies['@nestjs/config'];
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
console.log('[ok] @nestjs/config removido de auth-server');
"

# =============================================================================
# FIX 5 — ecommerce-back organizations-client/types: CollaboratorPermissions
# no existe en @real/auth-server. Reemplazar por Record<string, boolean>.
# =============================================================================
sep
log "FIX 5 — organizations-client/types: CollaboratorPermissions -> Record<string, boolean>..."

ORG_TYPES="realsass-ecommerce-back/src/organizations-client/types/organization-access.types.ts"

if [ -f "$ORG_TYPES" ]; then
  cat > "$ORG_TYPES" << 'EOF'
/**
 * Tipos locales para OrganizationsClientService.
 * Alineados con el contrato de GET /api/v1/auth/organization-access en sass-back.
 */
import type { TenantRole } from '@real/auth-server';

export type { TenantRole };

export interface OrganizationAccessResult {
  canAccess:       boolean;
  userId?:         string;
  organizationId?: string;
  role?:           TenantRole;
  permissions?:    Record<string, boolean>;
  reason?:         string;
}
EOF
  ok "organizations-client/types/organization-access.types.ts"
else
  echo "Archivo no encontrado, buscando..."
  find realsass-ecommerce-back/src -name "organization-access.types.ts" | while read f; do
    sed -i "s/import type { TenantRole, CollaboratorPermissions } from '@real\/auth-server'/import type { TenantRole } from '@real\/auth-server'/g" "$f"
    sed -i "s/CollaboratorPermissions/Record<string, boolean>/g" "$f"
    echo "[ok] Parcheado: $f"
  done
fi

# =============================================================================
# FIX 6 — ecommerce-back app.module.ts: aun puede tener import local
# =============================================================================
sep
log "FIX 6 — ecommerce-back app.module.ts: verificando imports..."

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
  FirebaseModule,
  FirebaseAuthGuard,
  CACHE_PORT,
  MemoryCacheAdapter,
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
EOF
ok "ecommerce-back/src/app.module.ts"

# =============================================================================
# RESUMEN
# =============================================================================
sep
echo -e "${BOLD}  FIX 2 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Corregido:${NC}"
echo "    [1] sass-back app.module.ts        — import FirebaseAuthGuard de @real/auth-server"
echo "    [2] sass-back + ecommerce-back     — @Roles('COLLABORATOR') -> @Roles('MEMBER')"
echo "    [3] sass-back users.service.ts     — ensureOrganization -> createForUser"
echo "    [4] auth-server firebase.module.ts — ConfigService -> process.env directo"
echo "    [5] ecommerce-back org-access types — CollaboratorPermissions -> Record<string,boolean>"
echo "    [6] ecommerce-back app.module.ts   — reescrito limpio"
echo ""
echo -e "${YELLOW}  Proximo paso:${NC}"
echo "    git add . && git commit -m 'fix: auth rebuild errors round 2' && git push"
echo ""
sep