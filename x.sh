#!/usr/bin/env bash
# =============================================================================
# x-markets-welver.sh
# Escribe la documentación de Markets en el monorepo welver/
# Ejecutar desde la raíz de welver/
# Git Bash (Windows): bash x-markets-welver.sh
# =============================================================================
set -e

echo "▶ [welver] Escribiendo documentación de Markets..."

# -----------------------------------------------------------------------------
# 1. ADR-014 — Decisión de arquitectura Markets
# -----------------------------------------------------------------------------
mkdir -p .claude/decisions

cat > .claude/decisions/ADR-014-markets-global.md << 'EOF'
# ADR-014 — Markets: expansión global de organizaciones

**Fecha:** 2026-09-19
**Estado:** Aceptado
**Autores:** Equipo GrupoJL

---

## Contexto

Las organizaciones del ecosistema welver operan en un país base (AR por defecto).
El crecimiento natural lleva a que una organización quiera operar en múltiples países:
vender en Colombia con un proveedor logístico colombiano, en México con uno mexicano,
sin mezclar stock ni envíos desde Argentina.

El problema tiene tres capas distintas que NO deben confundirse:

1. **Geolocalización del visitante** — ¿de dónde viene el comprador?
2. **Resolución de fulfillment** — ¿desde qué proveedor despacho en ese país?
3. **Segmentación de mercado** — ¿qué reglas operativas aplican en ese país?

---

## Referente: Shopify Markets (2021–presente)

Shopify es el referente porque modeló esto como **entidad de dominio de primer nivel**,
no como configuración de envío. Sus principios que adoptamos:

- Un `Market` es una presencia operativa declarada por el dueño, no detectada por el sistema
- El sistema resuelve dentro de los Markets declarados; si no hay match → fallback al default
- El catálogo es global; el fulfillment es local al Market
- Nunca se bloquea una venta por falta de Market — siempre hay fallback graceful

**Lo que NO copiamos de Shopify:**
- Precios por Market (Stripe maneja multi-moneda — duplicar sería deuda técnica)
- Idioma por Market (Next.js i18n lo resuelve independientemente)
- Impuestos por Market (Stripe Tax existe para eso, complejidad legal enorme)

---

## Decisión

### Bounded context: Market vive en `realsass-sass-back`

`Market` es una decisión del dueño del negocio (quiero operar en CO), no del catálogo.
`Organization` vive en `sass-back` → `Market` vive en `sass-back`.
`ecommerce-back` consume Markets vía tRPC para resolver fulfillment en órdenes.

**Alternativa descartada:** Market en ecommerce-back.
Razón: crearía acoplamiento inverso — el catálogo definiría contexto de negocio.
Viola el bounded context de domain/application.

### Modelo canónico

```
Organization
  ├── countryCode: "AR"           ← país base del dueño (nuevo campo)
  └── markets: Market[]
        ├── { countryCode: "AR", isDefault: true,  isActive: true }
        └── { countryCode: "CO", isDefault: false, isActive: true }
              └── fulfillmentConfig: JSONB
                    └── { provider: "Proveedor CO", contactEmail: "...", notes: "..." }
```

### Regla de resolución universal

```typescript
// Aplica a fulfillment, puntos de venta, config local — cualquier feature futuro
resolveMarket(organizationId, visitorCountryCode):
  1. Buscar Market{ organizationId, countryCode: visitorCountryCode, isActive: true }
  2. Si no existe → Market{ organizationId, isDefault: true }
  3. Nunca null — siempre resuelve
```

Una función. Resuelve todo. Escalable a 5 años sin cambiar el modelo.

---

## Consecuencias

### Positivas
- El dueño declara en qué países opera (control explícito, no magia de detección)
- Agregar un nuevo país = crear un Market, sin tocar código
- Futuras entidades (SalesPoint, Warehouse, PriceOverride) cuelgan de Market, no de Organization
- Superadmin ve Markets por organización sin lógica adicional

### Negativas / Riesgos
- `Organization` necesita migración para agregar `countryCode`
- La detección de IP del visitante requiere servicio externo (MaxMind GeoIP o similar)
- `fulfillmentConfig` como JSONB es flexible pero no tipado en DB — usar Zod en application layer

### Pendiente (fuera de este ADR)
- SalesPoint como entidad hija de Market
- Warehouse con stock por Market
- PriceOverride por Market (cuando se necesite)

---

## Implementación

Ver `.claude/modules/sass-back/markets.md` para el checklist de implementación.
Ver `.claude/contracts/markets-api.md` para los contratos HTTP y tRPC.
EOF

echo "  ✓ ADR-014-markets-global.md"

# -----------------------------------------------------------------------------
# 2. Módulo sass-back/markets.md — checklist de implementación
# -----------------------------------------------------------------------------
mkdir -p .claude/modules/sass-back

cat > .claude/modules/sass-back/markets.md << 'EOF'
# Módulo: Markets — realsass-sass-back

## Bounded context

`Market` representa la presencia operativa de una `Organization` en un país.
Una organización puede tener múltiples Markets activos.
Siempre existe un Market `isDefault: true` (el país base del dueño).

## Invariantes de dominio

1. Toda Organization tiene exactamente UN Market con `isDefault: true`
2. No pueden existir dos Markets con el mismo `(organizationId, countryCode)`
3. El Market default no puede ser desactivado si es el único activo
4. `countryCode` usa ISO 3166-1 alpha-2 (AR, CO, MX, BR, CL, UY...)
5. `fulfillmentConfig` es JSONB validado con Zod en application layer — nunca raw en controller

## Schema Prisma (agregar en realsass-sass-back/prisma/schema.prisma)

```prisma
// Agregar en model Organization:
//   countryCode  String   @default("AR") @map("country_code")
//   markets      Market[]

model Market {
  id                 String   @id @default(uuid())
  organizationId     String   @map("organization_id")
  countryCode        String   @map("country_code")      // ISO 3166-1 alpha-2
  isDefault          Boolean  @default(false) @map("is_default")
  isActive           Boolean  @default(true) @map("is_active")
  fulfillmentConfig  Json     @default("{}") @map("fulfillment_config")
  // fulfillmentConfig shape (Zod):
  // { provider?: string, contactEmail?: string, notes?: string, priority?: number }
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, countryCode])
  @@index([organizationId, isActive])
  @@map("markets")
}
```

## Estructura de archivos nuevos

```
realsass-sass-back/src/
  markets/
    domain/
      market.entity.ts          ← entidad + invariantes
      market.errors.ts          ← MarketNotFoundError, DuplicateMarketError, etc.
    repository/
      market.repository.interface.ts
      prisma-market.repository.ts
    markets.module.ts
    markets.service.ts          ← resolveMarket() vive aquí
  trpc/routers/
    markets.router.ts           ← CRUD + resolveMarket tRPC procedure
```

## resolveMarket() — la función central

```typescript
// markets.service.ts
async resolveMarket(organizationId: string, visitorCountryCode: string): Promise<Market> {
  const specific = await this.repo.findActive(organizationId, visitorCountryCode)
  if (specific) return specific

  const fallback = await this.repo.findDefault(organizationId)
  if (!fallback) throw new MarketNotFoundError(organizationId)

  return fallback
}
```

Esta función es el contrato central. Todo lo que dependa de país la llama.

## Endpoints HTTP (a través de tRPC)

| Procedure | Input | Output | Quién llama |
|-----------|-------|--------|-------------|
| `markets.list` | `{ organizationId }` | `Market[]` | dashboard-front, superadmin |
| `markets.create` | `{ organizationId, countryCode, fulfillmentConfig? }` | `Market` | sass-front (owner) |
| `markets.update` | `{ id, fulfillmentConfig?, isActive? }` | `Market` | sass-front (owner) |
| `markets.resolve` | `{ organizationId, countryCode }` | `Market` | ecommerce-back (interno) |
| `markets.setDefault` | `{ id }` | `Market` | sass-front (owner) |

## Checklist de implementación

- [ ] MKT-01: Migración Prisma — agregar `countryCode` en `Organization` + modelo `Market`
- [ ] MKT-02: `market.entity.ts` con invariantes tipadas
- [ ] MKT-03: `market.errors.ts` — `MarketNotFoundError`, `DuplicateMarketError`, `CannotDeactivateDefaultMarketError`
- [ ] MKT-04: `prisma-market.repository.ts` — `findActive()`, `findDefault()`, `findAll()`
- [ ] MKT-05: `markets.service.ts` — `resolveMarket()` + CRUD
- [ ] MKT-06: `markets.router.ts` tRPC con Zod validation en cada procedure
- [ ] MKT-07: Seed del Market default al crear Organization (en `organizations.service.ts`)
- [ ] MKT-08: Unit tests de `resolveMarket()` — caso específico, caso fallback, caso error
- [ ] MKT-09: Integration test tRPC — create, resolve, setDefault

## Reglas duras

- `resolveMarket()` NUNCA retorna null — siempre Market o throw
- Al crear Organization → crear Market default automáticamente (mismo `countryCode` que org)
- El `countryCode` en Organization es inmutable después de creación (ADR futuro si cambia)
- `fulfillmentConfig` siempre validado con Zod antes de persistir — nunca `as any`
EOF

echo "  ✓ modules/sass-back/markets.md"

# -----------------------------------------------------------------------------
# 3. Módulo ecommerce-back/markets.md — cómo lo consume el ecommerce
# -----------------------------------------------------------------------------
mkdir -p .claude/modules/ecommerce-back

cat > .claude/modules/ecommerce-back/markets.md << 'EOF'
# Markets en ecommerce-back — consumidor del contexto global

## Rol en este servicio

`ecommerce-back` NO posee el modelo Market — lo consume desde `sass-back` vía tRPC.
Su responsabilidad es **resolver el Market del visitante antes de cualquier operación
de fulfillment** (creación de orden, cálculo de envío, asignación de proveedor).

## Flujo de resolución en checkout

```
POST /checkout (ecommerce-back)
  → 1. Leer visitorCountryCode del request (header X-Visitor-Country o IP)
  → 2. Llamar trpc.markets.resolve({ organizationId, countryCode })
  → 3. Guardar marketId + fulfillmentConfig en la Order
  → 4. Stripe procesa el pago (él maneja multi-moneda)
  → 5. Orden creada con contexto de Market resuelto
```

## Campos nuevos en Order (ecommerce-back/prisma/schema.prisma)

```prisma
model Order {
  // ... campos existentes ...
  marketId            String?  @map("market_id")        // Market resuelto al momento del checkout
  visitorCountryCode  String?  @map("visitor_country_code") // País detectado del visitante
  fulfillmentSnapshot Json     @default("{}") @map("fulfillment_snapshot")
  // Snapshot de fulfillmentConfig al momento de la orden — inmutable post-creación
}
```

## Detección del país del visitante

Orden de precedencia (de mayor a menor prioridad):
1. Header `X-Visitor-Country` (enviado por el front si el usuario lo seleccionó)
2. Header `CF-IPCountry` (Cloudflare, si se usa como CDN)
3. IP geolocation via servicio externo (MaxMind o ip-api.com como fallback)
4. País default de la Organization

```typescript
// lib/resolve-visitor-country.ts en real-ecommerce-front
function resolveVisitorCountry(request: NextRequest): string {
  return (
    request.headers.get('X-Visitor-Country') ??
    request.headers.get('CF-IPCountry') ??
    'default' // ecommerce-back hará fallback al Market default
  )
}
```

## Checklist de implementación

- [ ] MKT-E-01: tRPC client call a `markets.resolve` desde `OrganizationsClientService`
- [ ] MKT-E-02: Migración Prisma — `marketId` + `visitorCountryCode` + `fulfillmentSnapshot` en `Order`
- [ ] MKT-E-03: `resolveVisitorCountry()` util en real-ecommerce-front
- [ ] MKT-E-04: Pasar `X-Visitor-Country` header en requests de checkout desde el front
- [ ] MKT-E-05: Guardar `fulfillmentSnapshot` al crear Order (inmutable)
- [ ] MKT-E-06: Test de integración — checkout con CO resuelve Market CO, sin Market CO resuelve default

## Regla de oro

El `fulfillmentSnapshot` en Order es **inmutable** una vez creada.
Si el dueño cambia la config del Market después, las órdenes anteriores no se ven afectadas.
Mismo patrón que `unitPriceCentsSnapshot` en CartItem — snapshot al momento de la transacción.
EOF

echo "  ✓ modules/ecommerce-back/markets.md"

# -----------------------------------------------------------------------------
# 4. Módulo ecommerce-front/markets.md
# -----------------------------------------------------------------------------
mkdir -p .claude/modules/ecommerce-front

cat > .claude/modules/ecommerce-front/markets.md << 'EOF'
# Markets en real-ecommerce-front — resolución del visitante

## Responsabilidad

El storefront es el punto de entrada del comprador.
Su responsabilidad respecto a Markets:

1. Detectar el país del visitante (IP o selección manual)
2. Enviar `X-Visitor-Country` header en requests al backend
3. Mostrar un selector de país/mercado si la org tiene múltiples Markets activos
4. Adaptar la UX al Market resuelto (nombre de proveedor, info de envío local)

## Selector de mercado (UX pattern de Shopify)

Shopify muestra un banner/modal al detectar que el visitante es de un país diferente:
"Parece que estás en Colombia. ¿Querés ver los envíos desde nuestro proveedor local?"

Implementar como:
- Componente `<MarketBanner />` — aparece si `detectedCountry !== currentMarket.countryCode`
- Zustand store `useMarketStore` — persiste la selección del usuario en sessionStorage
- Si el usuario elige → setea `X-Visitor-Country` en todos los requests posteriores

## Checklist de implementación

- [ ] MKT-F-01: `useMarketStore` en Zustand — `{ currentCountry, setCountry }`
- [ ] MKT-F-02: `resolveVisitorCountry()` en `lib/market/resolver.ts`
- [ ] MKT-F-03: Interceptor en `apiFetch` para agregar `X-Visitor-Country` header
- [ ] MKT-F-04: `<MarketBanner />` componente (shadcn/ui Alert base)
- [ ] MKT-F-05: Integrar en `store-provider.tsx` — detectar país al montar la tienda
EOF

echo "  ✓ modules/ecommerce-front/markets.md"

# -----------------------------------------------------------------------------
# 5. Contratos de Markets API
# -----------------------------------------------------------------------------
mkdir -p .claude/contracts

cat > .claude/contracts/markets-api.md << 'EOF'
# Contratos: Markets API

## tRPC procedures (sass-back → todos los consumidores)

```typescript
// packages/trpc/src/routers/markets.ts

// Input schemas (Zod)
const FulfillmentConfigSchema = z.object({
  provider:       z.string().optional(),
  contactEmail:   z.string().email().optional(),
  notes:          z.string().optional(),
  priority:       z.number().int().min(1).default(1),
})

const CreateMarketInput = z.object({
  organizationId:    z.string().uuid(),
  countryCode:       z.string().length(2).toUpperCase(), // ISO 3166-1 alpha-2
  fulfillmentConfig: FulfillmentConfigSchema.optional(),
})

const ResolveMarketInput = z.object({
  organizationId: z.string().uuid(),
  countryCode:    z.string().length(2).toUpperCase(),
})

// Output type
type MarketDTO = {
  id:                string
  organizationId:    string
  countryCode:       string   // "AR" | "CO" | "MX" ...
  isDefault:         boolean
  isActive:          boolean
  fulfillmentConfig: FulfillmentConfig
  createdAt:         string
  updatedAt:         string
}
```

## HTTP endpoints (via tRPC HTTP adapter)

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/trpc/markets.list?input={"organizationId":"..."}` | JWT owner/admin | Lista Markets de la org |
| POST | `/trpc/markets.create` | JWT owner | Crear nuevo Market |
| PATCH | `/trpc/markets.update` | JWT owner | Actualizar fulfillmentConfig o isActive |
| POST | `/trpc/markets.setDefault` | JWT owner | Cambiar Market default |
| GET | `/trpc/markets.resolve?input={"organizationId":"...","countryCode":"CO"}` | INTERNAL_API_KEY | Resolver Market para fulfillment |

## Header de contexto de país

```
X-Visitor-Country: CO   // ISO 3166-1 alpha-2, enviado por el front
```

Procesado en ecommerce-back como primer input de `resolveMarket()`.

## Países soportados inicialmente (expandible sin código)

AR · CO · MX · BR · CL · UY · PE · EC · BO · PY

Agregar un país = crear un Market en el dashboard. Sin deploys.
EOF

echo "  ✓ contracts/markets-api.md"

# -----------------------------------------------------------------------------
# 6. Norte de Markets en CLAUDE.md (append)
# -----------------------------------------------------------------------------

cat >> .claude/CLAUDE.md << 'EOF'

---

## Markets — expansión global (ADR-014)

### El norte: Shopify Markets

Shopify resolvió la expansión global como entidad de dominio, no como config de envío.
Adoptamos su filosofía: el dueño **declara** en qué países opera; el sistema **resuelve**.

### Principio de resolución

```
resolveMarket(organizationId, visitorCountryCode)
  → Market específico del país  (si existe y está activo)
  → Market default de la org    (fallback siempre disponible)
  → NUNCA null, NUNCA bloqueo
```

### Bounded contexts

| Repo | Rol |
|------|-----|
| `realsass-sass-back` | OWNER del modelo Market — CRUD, resolveMarket() |
| `realsass-ecommerce-back` | CONSUMER — llama resolveMarket() en checkout, guarda snapshot |
| `real-ecommerce-front` | DETECTOR — detecta país del visitante, envía X-Visitor-Country |
| `realsass-dashboard-front` | UI — gestión de Markets del dueño |

### Lo que NO modelamos (y por qué)

- Precios por Market → Stripe maneja multi-moneda
- Idioma por Market → Next.js i18n
- Impuestos por Market → Stripe Tax
- Restricciones de productos por país → over-engineering para escala actual

### Siguiente paso

Ver ADR-014 y los checklists MKT-01..09 en `.claude/modules/sass-back/markets.md`
EOF

echo "  ✓ CLAUDE.md actualizado"

# -----------------------------------------------------------------------------
# 7. Actualizar lifecycle/tasks.md con tareas de Markets
# -----------------------------------------------------------------------------
mkdir -p .claude/lifecycle

cat >> .claude/lifecycle/tasks.md << 'EOF'

---

## Sprint Markets — ADR-014

### sass-back (bloqueante para el resto)

- [ ] MKT-01: Migración Prisma — `countryCode` en Organization + modelo Market
- [ ] MKT-02: `market.entity.ts` con invariantes
- [ ] MKT-03: `market.errors.ts`
- [ ] MKT-04: `prisma-market.repository.ts`
- [ ] MKT-05: `markets.service.ts` — `resolveMarket()` es el núcleo
- [ ] MKT-06: `markets.router.ts` tRPC
- [ ] MKT-07: Seed Market default al crear Organization
- [ ] MKT-08: Unit tests resolveMarket()
- [ ] MKT-09: Integration test tRPC

### ecommerce-back (depende de MKT-06)

- [ ] MKT-E-01: tRPC client call a markets.resolve
- [ ] MKT-E-02: Migración Order — marketId + visitorCountryCode + fulfillmentSnapshot
- [ ] MKT-E-03: resolveVisitorCountry() util
- [ ] MKT-E-04: X-Visitor-Country header en checkout
- [ ] MKT-E-05: fulfillmentSnapshot inmutable en Order
- [ ] MKT-E-06: Integration test checkout CO → Market CO

### ecommerce-front (depende de MKT-E-01)

- [ ] MKT-F-01: useMarketStore Zustand
- [ ] MKT-F-02: resolveVisitorCountry() en lib/market/resolver.ts
- [ ] MKT-F-03: X-Visitor-Country en apiFetch interceptor
- [ ] MKT-F-04: MarketBanner componente
- [ ] MKT-F-05: Integrar en store-provider.tsx

### dashboard-front (depende de MKT-06)

- [ ] MKT-D-01: Página /dashboard/mercados
- [ ] MKT-D-02: Lista de Markets activos con fulfillmentConfig
- [ ] MKT-D-03: Crear/editar Market con selector de país ISO
- [ ] MKT-D-04: Toggle isActive con confirmación
EOF

echo "  ✓ lifecycle/tasks.md actualizado"

echo ""
echo "✅ [welver] Markets documentado en .claude/"
echo ""
echo "Archivos creados/modificados:"
echo "  .claude/decisions/ADR-014-markets-global.md"
echo "  .claude/modules/sass-back/markets.md"
echo "  .claude/modules/ecommerce-back/markets.md"
echo "  .claude/modules/ecommerce-front/markets.md"
echo "  .claude/contracts/markets-api.md"
echo "  .claude/CLAUDE.md  (append)"
echo "  .claude/lifecycle/tasks.md  (append)"
echo ""
echo "Siguiente paso: bash x-markets-ecosistema-ms.sh (en ecosistema-ms/)"