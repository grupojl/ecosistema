#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX 5: Dos problemas de runtime
#
# PROBLEMA 1 — sass-back: Cannot find module '/app/dist/src/main'
#   El Dockerfile tiene CMD ["dumb-init", "node", "dist/src/main"]
#   pero webpack con nest build genera dist/main.js (un solo archivo bundleado)
#   no dist/src/main.js (la estructura de carpetas sin webpack)
#   SOLUCION: corregir el CMD en el Dockerfile de sass-back
#
# PROBLEMA 2 — ecommerce-back: TenantGuard no puede resolver CACHE_PORT en CatalogModule
#   TenantGuard se usa con @UseGuards(TenantGuard) en los controllers.
#   NestJS intenta instanciar TenantGuard dentro del contexto del modulo
#   del controller (CatalogModule, InventoryModule, etc.) donde CACHE_PORT
#   no esta registrado como provider.
#   SOLUCION: crear AuthInfraModule en ecommerce-back que registre CACHE_PORT
#   y exporte TenantGuard — los modulos que lo usen importan AuthInfraModule.
#   O mas simple: usar APP_GUARD global para TenantGuard tambien.
# =============================================================================

set -euo pipefail
[ -f "pnpm-workspace.yaml" ] || { echo "Corre desde la raiz"; exit 1; }

BOLD='\033[1m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
log() { echo -e "${BLUE}[->]${NC} $1"; }
sep() { echo -e "${BOLD}----------------------------------------------------${NC}"; }

sep
echo -e "${BOLD}  FIX 5 — Runtime errors${NC}"
sep

# =============================================================================
# FIX 1 — sass-back Dockerfile: dist/src/main -> dist/main
# webpack genera un solo archivo: dist/main.js
# sin webpack genera: dist/src/main.js
# Con webpack activo el CMD correcto es node dist/main
# =============================================================================
log "FIX 1 — Corrigiendo CMD en Dockerfile de sass-back..."

# Reemplazar la linea del CMD
sed -i 's|CMD \["dumb-init", "node", "dist/src/main"\]|CMD ["dumb-init", "node", "dist/main"]|g' \
  realsass-sass-back/Dockerfile

ok "sass-back/Dockerfile: CMD corregido a dist/main"

# Tambien corregir start:prod en package.json de sass-back por consistencia
node -e "
const fs  = require('fs');
const p   = 'realsass-sass-back/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
// start:prod debe arrancar sin prisma migrate en Railway
// (las migraciones se corren separado o en release command)
pkg.scripts['start:prod'] = 'node dist/main';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
console.log('[ok] start:prod corregido en sass-back');
"

# =============================================================================
# FIX 2 — ecommerce-back: CACHE_PORT no resuelto en CatalogModule
#
# El problema: @UseGuards(TenantGuard) en los controllers hace que NestJS
# intente instanciar TenantGuard en el contexto del modulo del controller.
# TenantGuard tiene @Inject(CACHE_PORT) pero CACHE_PORT no esta en ese modulo.
#
# Solucion correcta: registrar TenantGuard como APP_GUARD global igual que
# FirebaseAuthGuard. Asi NestJS lo instancia una sola vez en el contexto
# global donde CACHE_PORT si esta disponible.
#
# Esto implica:
#   1. Remover @UseGuards(TenantGuard) y @UseGuards(RolesGuard) de los controllers
#      que lo tenian inline
#   2. Agregar TenantGuard como APP_GUARD en AppModule
#   3. Usar @Public() o un decorator especial para rutas publicas del ecommerce
#
# PERO — hay un problema de diseno: TenantGuard requiere x-organization-id
# header, que no todas las rutas tienen (el storefront publico no lo manda).
# Si hacemos TenantGuard global, las rutas publicas van a fallar.
#
# Solucion: TenantGuard revisa si la ruta tiene @Public() y la skipea,
# igual que FirebaseAuthGuard. Actualizar TenantGuard para esto.
# =============================================================================
log "FIX 2 — Actualizando TenantGuard para soporte @Public() y registro global..."

cat > packages/auth-server/src/guards/tenant.guard.ts << 'EOF'
import {
  CanActivate, ExecutionContext, ForbiddenException,
  Inject, Injectable, Logger, UnauthorizedException,
} from '@nestjs/common';
import { Reflector }     from '@nestjs/core';
import { CACHE_PORT }    from '../ports/cache.port';
import type { CachePort } from '../ports/cache.port';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type {
  TenantContext, CurrentUserPayload, OrganizationAccessResult,
} from '../types/tenant-context';

const CACHE_TTL = 90;

/**
 * TenantGuard — resuelve TenantContext para ecommerce-back.
 *
 * IMPORTANTE: registrar como APP_GUARD global en AppModule, NO con @UseGuards().
 * Si se registra con @UseGuards() NestJS intenta instanciarlo en el modulo
 * del controller donde CACHE_PORT no esta disponible.
 *
 * Skipea rutas con @Public() — igual que FirebaseAuthGuard.
 * Skipea rutas sin header x-organization-id (storefront publico).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    @Inject(CACHE_PORT) private readonly cache: CachePort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Skip rutas publicas
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req            = ctx.switchToHttp().getRequest();
    const user           = req.user as CurrentUserPayload | undefined;
    const organizationId = req.headers['x-organization-id'] as string | undefined;
    const token          = this.extractToken(req);

    // Sin organizationId — puede ser una ruta que no requiere tenant context
    // (ej: rutas de salud, rutas de store publico sin auth)
    // En ese caso simplemente no inyectamos tenant y dejamos pasar
    if (!organizationId) return true;

    if (!user?.uid)  throw new UnauthorizedException('Usuario no autenticado');
    if (!token)      throw new UnauthorizedException('Bearer token requerido');

    const cacheKey = `org-access:${user.uid}:${organizationId}`;

    const cached = await this.cache.get<TenantContext>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      req.tenant = cached;
      return true;
    }

    const sassBackUrl = process.env['SASS_BACK_URL'];
    if (!sassBackUrl) {
      throw new ForbiddenException('Variable de entorno SASS_BACK_URL no configurada');
    }

    let result: OrganizationAccessResult;
    try {
      const res = await fetch(`${sassBackUrl}/api/v1/auth/organization-access`, {
        headers: {
          'Authorization':     `Bearer ${token}`,
          'x-organization-id': organizationId,
        },
      });
      if (!res.ok) throw new ForbiddenException('Sin acceso a esta organizacion');
      result = await res.json() as OrganizationAccessResult;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Error en organization-access: ${(error as Error).message}`);
      throw new ForbiddenException('Error al verificar permisos');
    }

    if (!result.canAccess || !result.role || !result.userId) {
      throw new ForbiddenException(result.reason ?? 'Sin acceso a esta organizacion');
    }

    const tenantCtx: TenantContext = {
      userId:         result.userId,
      organizationId: result.organizationId ?? organizationId,
      role:           result.role,
      permissions:    result.permissions ?? {},
    };

    await this.cache.set(cacheKey, tenantCtx, CACHE_TTL);
    req.tenant = tenantCtx;
    return true;
  }

  private extractToken(req: { headers: Record<string, string | undefined> }): string | undefined {
    const [type, token] = req.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
EOF
ok "packages/auth-server/src/guards/tenant.guard.ts actualizado"

# =============================================================================
# FIX 3 — ecommerce-back AppModule: agregar TenantGuard como APP_GUARD global
# Remover @UseGuards(TenantGuard) de todos los controllers via sed
# =============================================================================
log "FIX 3 — TenantGuard como APP_GUARD en ecommerce-back..."

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
EOF
ok "ecommerce-back/src/app.module.ts"

# Remover @UseGuards(TenantGuard) y @UseGuards(RolesGuard) de controllers
# ya que ahora son globales — tenerlos inline duplicaria la ejecucion
log "Removiendo @UseGuards inline de controllers de ecommerce-back..."

find realsass-ecommerce-back/src -name "*.controller.ts" | while read -r f; do
  # Remover @UseGuards(TenantGuard) — puede estar solo o combinado
  sed -i "s/@UseGuards(TenantGuard, RolesGuard)//g" "$f"
  sed -i "s/@UseGuards(TenantGuard)//g" "$f"
  sed -i "s/@UseGuards(RolesGuard)//g" "$f"
  # Remover imports de UseGuards si quedan huerfanos
  sed -i "/^import.*UseGuards.*from '@nestjs\/common'/{ s/, UseGuards//g; s/UseGuards, //g; s/{ UseGuards }/{ }/g; }" "$f"
done

ok "Controllers de ecommerce-back: @UseGuards inline removidos"

# =============================================================================
# FIX 4 — sass-back: mismo patron, RolesGuard como APP_GUARD global
# =============================================================================
log "FIX 4 — Agregando RolesGuard como APP_GUARD global en sass-back..."

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
  RolesGuard,
  CACHE_PORT,
  MemoryCacheAdapter,
} from '@real/auth-server';

// sass-back NO usa TenantGuard — el TenantContext se resuelve directamente
// desde Prisma en cada service (sin hop de red).

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
    { provide: APP_GUARD,  useClass: RolesGuard },
    { provide: APP_GUARD,  useClass: ThrottlerGuard },
    { provide: CACHE_PORT, useClass: MemoryCacheAdapter },
  ],
})
export class AppModule {}
EOF
ok "sass-back/src/app.module.ts"

# Remover @UseGuards inline de controllers de sass-back tambien
log "Removiendo @UseGuards inline de controllers de sass-back..."

find realsass-sass-back/src -name "*.controller.ts" | while read -r f; do
  sed -i "s/@UseGuards(TenantGuard, RolesGuard)//g" "$f"
  sed -i "s/@UseGuards(TenantGuard)//g" "$f"
  sed -i "s/@UseGuards(RolesGuard)//g" "$f"
  sed -i "/^import.*UseGuards.*from '@nestjs\/common'/{ s/, UseGuards//g; s/UseGuards, //g; s/{ UseGuards }/{ }/g; }" "$f"
done

ok "Controllers de sass-back: @UseGuards inline removidos"

# =============================================================================
# RESUMEN
# =============================================================================
sep
echo -e "${BOLD}  FIX 5 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Corregido:${NC}"
echo "    [1] sass-back Dockerfile: CMD dist/src/main -> dist/main"
echo "    [2] TenantGuard: soporte @Public() + skip sin x-organization-id"
echo "    [3] ecommerce-back: TenantGuard y RolesGuard como APP_GUARD global"
echo "    [4] sass-back: RolesGuard como APP_GUARD global"
echo "    [5] Controllers: @UseGuards() inline removidos (ahora son globales)"
echo ""
echo -e "${GREEN}  Por que esto funciona:${NC}"
echo "    APP_GUARD se instancia en el contexto global de la app donde"
echo "    CACHE_PORT si esta disponible. @UseGuards() local lo instancia"
echo "    en el contexto del modulo del controller, donde no esta."
echo ""
echo "  git add . && git commit -m 'fix: guards as APP_GUARD global, fix CMD path' && git push"
echo ""
sep