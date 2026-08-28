#!/usr/bin/env bash
set -euo pipefail

MONOREPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE="$MONOREPO_ROOT/.claude"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
ok()  { echo -e "${GREEN}[✓]${NC} $*"; }
log() { echo -e "${CYAN}[x.sh]${NC} $*"; }

log "Creando ADR-005-rest-to-trpc.md..."

cat > "$CLAUDE/decisions/ADR-005-rest-to-trpc.md" << 'EOF'
# ADR-005: Migración completa de REST a tRPC — REST solo para endpoints públicos

**Fecha:** 2026-08-28
**Estado:** Aceptado

## Contexto

El ecosistema tiene dos capas de comunicación cliente-servidor que conviven:

1. **tRPC** — introducido en S1/S2, hoy es el canal principal para todos los
   fronts. Type-safety end-to-end, Zod en los inputs, inferencia automática
   de tipos en los hooks.

2. **REST (NestJS controllers)** — el canal original. Hoy sirve tres propósitos:
   - Endpoints internos entre backs (ej: `OrganizationsClientService` de ecommerce-back → sass-back)
   - Endpoints públicos del storefront (ej: `GET /ecommerce/public/by-slug/:slug`)
   - Endpoints legacy que no migraron cuando se introdujo tRPC

Con la Capa 4 (Repository) completa en todos los módulos, los controllers REST
legacy son el único lugar donde queda lógica de presentación mezclada con
la capa de aplicación. Mantener dos canales paralelos tiene costos:

- **Duplicación de validación**: DTOs class-validator en REST + schemas Zod en tRPC
- **Dos modelos de auth**: `@CurrentUser()` + `@Tenant()` en REST vs `ctx.uid`/`ctx.tenant` en tRPC
- **Inconsistencia de errores**: `HttpException` en REST vs `TRPCError` en tRPC
- **DTOs obsoletos**: clases con class-validator que no aportan nada que Zod
  no haga mejor y que el compilador no puede validar end-to-end

## Decisión

**Eliminar todos los controllers REST internos. REST solo para:**

1. **Endpoints públicos del storefront** — consumidos por browsers sin auth,
   SSG/ISR de Next.js, o servicios externos:
   - `GET /ecommerce/public/by-slug/:slug`
   - `GET /ecommerce/public/:orgId/catalog/*`
   - `POST /ecommerce/public/:orgId/customers/identify`
   - `GET /health` (cualquier back)

2. **Endpoints back-to-back** — consumidos por otro back, no por un front:
   - `GET /auth/organization-access` (sass-back → consumido por ecommerce-back)
   - `POST /auth/firebase-sso` (redirect entre fronts, necesita `res.redirect()`)

3. **Webhooks outbound** — callbacks de sistemas externos (Stripe, couriers, etc.)
   cuando existan.

**Todo lo demás pasa a tRPC.**

## Plan de migración (para ejecutar mañana)

### sass-back — controllers a eliminar

| Controller | Reemplazado por |
|---|---|
| `AuthController` (sync, me, refreshClaims, firebase-sso*) | `auth.*` router tRPC (ya existe) · firebase-sso queda en REST |
| `UsersController` (me, selectRole) | `auth.*` router tRPC (ya existe) |
| `OrganizationsController` (getMyOrg, updateMyOrg) | `organizations.*` router tRPC (ya existe) |
| `CollaboratorsController` (list, invite, update, remove) | `collaborators.*` router tRPC (ya existe) |
| `ConfigFlagsController` | `configFlags.*` router tRPC (ya existe) |
| `ConfigQuotasController` | `configQuotas.*` router tRPC (ya existe) |
| `ConfigThemesController` | `configThemes.*` router tRPC (ya existe) |
| `ConfigWebhooksController` | `configWebhooks.*` router tRPC (ya existe) |
| `ConfigAuditController` | `configAudit.*` router tRPC (ya existe) |
| `ConfigSecretsController` | `configSecrets.*` router tRPC (ya existe) |
| `ConfigTemplatesController` | agregar `configTemplates.*` router tRPC |
| `AffiliatesController` | agregar `affiliates.*` router tRPC |

**Mantener en REST:**
- `HealthController` — healthcheck de Railway
- `OrganizationsController.getBySlugPublic` — consumido por ecommerce-back
- `AuthController.firebaseSso` — redirect entre fronts
- `AuthController.organizationAccess` — consumido por ecommerce-back

### sass-back — DTOs a eliminar (post-migración)

Una vez eliminados los controllers que los usan:
- `auth/dto/sync.dto.ts`
- `collaborators/dto/invite-collaborator.dto.ts`
- `collaborators/dto/update-collaborator.dto.ts`
- `config-flags/dto/update-flag.dto.ts`
- `config-secrets/dto/create-secret.dto.ts`
- `config-templates/dto/create-template.dto.ts`
- `config-themes/dto/create-theme.dto.ts`
- `config-webhooks/dto/create-webhook.dto.ts`
- `organizations/dto/update-organization.dto.ts`
- `affiliate/dto/create-affiliate.dto.ts` ← clase vacía, eliminar ya
- `affiliate/dto/update-affiliate.dto.ts` ← clase vacía, eliminar ya

### sass-back — archivos duplicados a eliminar

- `users/types/organization-access.types.ts` — duplicado de `@real/auth-server`
- `common/guards/tenant.guard.ts` — duplicado de `@real/auth-server`

### ecommerce-back — controllers a revisar

| Controller | Acción |
|---|---|
| `CatalogController` (admin) | migrar a `adminCatalog.*` router tRPC (ya existe) |
| `InventoryController` (admin) | migrar a `adminInventory.*` router tRPC (ya existe) |
| `OrdersController` (admin) | migrar a `adminOrders.*` router tRPC (ya existe) |
| `CartController` | migrar a `customer.*` router tRPC (ya existe) |
| `CustomersController` | mantener `POST /identify` en REST (público) · resto a tRPC |
| `ActivityController` | evaluar si tiene consumidor activo |
| `PublicCatalogController` | ✅ mantener — endpoints públicos del storefront |
| `CheckoutController` | ✅ mantener — endpoint público |
| `StoreController` | ✅ mantener — by-slug es consumido por ecommerce-back |

### ecommerce-back — archivos duplicados a eliminar

- `common/types/tenant-context.ts` — duplicado de `@real/auth-server`

## Alternativas descartadas

- **Mantener REST + tRPC en paralelo indefinidamente:** el costo de mantener
  dos capas de validación, dos modelos de error y dos sets de tests supera
  cualquier beneficio. La inconsistencia crece con cada feature nueva.

- **Eliminar tRPC y volver a REST:** va en contra del type-safety end-to-end
  que ya tenemos. Los fronts perderían inferencia automática de tipos.

- **REST para todo (incluyendo fronts):** descartado — perdemos la Capa 5
  (AppRouter tipado) que es el principal diferenciador arquitectónico.

## Consecuencias

**Ganancia:**
- Un solo canal de comunicación front→back — sin ambigüedad sobre cuál usar
- DTOs class-validator eliminados — Zod es la única capa de validación
- Consistencia de errores — `TRPCError` en todos los casos internos
- Menos archivos = menos superficie de mantenimiento
- Los `*.module.ts` se simplifican — sin controllers REST que importar

**Costo / deuda técnica consciente:**
- Los controllers REST existentes deben eliminarse uno a uno — no es un cambio
  atómico. Riesgo de romper algo si un front todavía usa un endpoint REST
  directamente (verificar antes de eliminar cada controller).
- Algunos procedures tRPC nuevos deben crearse antes de poder eliminar el
  controller REST correspondiente (`configTemplates.*`, `affiliates.*`).

## Orden de ejecución recomendado

1. Crear procedures tRPC faltantes (`configTemplates.*`, `affiliates.*`)
2. Verificar que ningún front llama REST directamente para esos endpoints
3. Eliminar controllers REST uno a uno, empezando por los más simples
4. Eliminar DTOs que queden huérfanos
5. Eliminar archivos duplicados (`users/types/`, `common/types/`)
6. Eliminar `common/guards/tenant.guard.ts` del sass-back si no tiene uso local

## Referencias

- `realsass-sass-back/src/trpc/routers/` — routers tRPC existentes
- `realsass-ecommerce-back/src/trpc/routers/` — routers tRPC existentes
- `architecture/01-backend-capas.md` — Capa 2 Router/Contrato
- `architecture/03-reglas-duras.md` — reglas de enforcement
- `roadmap/deuda-tecnica.md` — DTOs y archivos pendientes de eliminar
EOF

ok "ADR-005-rest-to-trpc.md creado"

echo ""
echo "[x.sh SUMMARY]"
echo "status:        OK"
echo "files_created: .claude/decisions/ADR-005-rest-to-trpc.md"
echo "contenido:     Plan completo de migración REST → tRPC"
echo "               con tabla de cada controller, qué mantener y qué eliminar"
echo "timestamp:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"