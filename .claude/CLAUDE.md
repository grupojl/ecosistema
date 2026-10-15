# Ecosistema Real — Documentación de arquitectura

> Este directorio es la memoria persistente del proyecto. Antes de implementar
> cualquier feature, se consulta esta documentación. No se redefine desde cero
> lo que ya está decidido acá.

## Resumen de una línea

SaaS multi-tenant donde cada organización gestiona su negocio (catálogo, stock,
órdenes, config, colaboradores) a través de 3 frontends Next.js sobre 2 backends
NestJS compartidos, con auth/tenant resuelto una sola vez y contrato tipado
end-to-end vía tRPC.

## Principio de comunicación — NO NEGOCIABLE

> **Todo lo interno se comunica via tRPC (o gRPC cuando aplique).
> REST solo se expone cuando hay una API pública para consumidores externos.**

Esto aplica sin excepción a:
- Front → Back: tRPC
- Back → Back: tRPC HTTP o gRPC
- Server Components → Back: tRPC server caller (no fetch manual)
- Client Components: rehidratan desde Server Components, no hacen fetch propio

REST se usa ÚNICAMENTE para:
1. APIs públicas para consumidores externos (terceros, integraciones)
2. Webhooks inbound de sistemas externos (Stripe, couriers, etc.)
3. `POST /auth/session` + `DELETE /auth/session` — bootstrap de cookies HttpOnly
   (excepción técnica: tRPC no puede setear headers Set-Cookie, ADR-004)
4. `GET /health` — healthcheck de Railway

**Cualquier fetch manual o endpoint REST interno es un bug de arquitectura.**

## Modelo de rendering — Next.js App Router

```
Server Component
  → createServerCaller() tRPC (sin React, sin hooks)
  → renderiza HTML con datos
  → pasa datos via props a Client Components

Client Component
  → rehidrata con useQuery() misma queryKey que el server prefetch
  → NUNCA hace fetch propio al back
  → NUNCA llama REST directamente
```

## Contrato vs snapshot

Antes de editar cualquier archivo de esta carpeta, identificar a qué grupo pertenece.

### 🔒 No modificables de base (contrato)

Responden a **"¿cómo debería ser esto?"**. Son la fuente de verdad no negociable.
Se editan solo por decisión explícita de arquitectura, nunca para que "cuadren"
con una desviación del código real.

- `architecture/` — capas, principios, reglas duras
- `contracts/` — shapes de tenant-context, organization-access, routers tRPC
- `decisions/ADR-*.md` — decisiones tomadas e inmutables

### 🔄 Dinámicos (snapshot del estado actual)

Responden a **"¿cómo está esto hoy?"**. Se actualizan con cada sesión de trabajo.

- `roadmap/sprints.md` — estado de sprints
- `roadmap/deuda-tecnica.md` — deuda pendiente
- `services/*.md` — estado actual de cada servicio

## Stack canónico

**Backend (2 servicios hoy, 6 en roadmap):**
Node.js · TypeScript strict · NestJS · Prisma ORM · PostgreSQL · Redis · pnpm workspaces · Docker

**Frontend (3 apps):**
Next.js 15 App Router · React 19 · TypeScript strict · TailwindCSS · shadcn/ui · TanStack Query · Zustand

**Comunicación:**
tRPC (interno) · gRPC (cuando aplique, futuro) · REST (solo APIs públicas externas)

**Observabilidad:** OpenTelemetry · Prometheus · Grafana (S4)
**Testing:** Jest · Supertest · Vitest · React Testing Library · Playwright (S4)
**Seguridad:** Firebase Auth + Session Cookies HttpOnly · RBAC · Helmet · Rate limiting

## Packages compartidos

| Package | Rol |
|---|---|
| `@real/auth-client` | Firebase wrapper + apiFetch para los 3 fronts |
| `@real/auth-server` | Guards, middleware, SessionService para los 2 backs |
| `@real/trpc` | Contratos tRPC — SassAppRouter + EcommerceAppRouter |
| `@real/ui` | 33 componentes shadcn — fuente única de UI |

---

## Integración con marketing-backend — contexto (2026-09-19)

**welver NO tiene código de marketing.** El microservicio vive en ecosistema-ms.

### Qué sí hace welver en este contexto

`realsass-sass-back` (pasarelapagos-backend de welver) **no existe** —
welver no tiene pasarela de pagos propia. El fire-forget de atribución
fue implementado en `pasarelapagos-backend` de **ecosistema-ms**.

### Resumen de qué vive donde

| Componente | Repo | Estado |
|-----------|------|--------|
| `marketing-backend` (servicio completo) | ecosistema-ms | ✅ |
| Fire-forget en `WebhookProcessor` | ecosistema-ms / pasarelapagos-backend | ✅ |
| `MarketingClient` en superadmin | superadmin | ✅ |
| Contrato documentado en welver | welver / .claude | ✅ (solo doc) |

### Por qué hay contratos de marketing en este .claude

El `tasks.md` tenía un pendiente de fire-forget para `pasarelapagos-backend`.
Ese pendiente fue documentado aquí por error de contexto — en realidad
corresponde a ecosistema-ms, no a welver. Ya está resuelto.

Ver `.claude/contracts/marketing-integration.md` para el contrato completo.

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

<!-- ADR-016 -->
---

## SEO + idioma global (ADR-016)

### El norte

**Shopify Markets** (estructura) · **Apple** (no forzar) · **Airbnb / Booking** (el usuario manda) ·
**IKEA** (idioma ≠ país) · **Mercado Libre** (LatAm primero) · **Google Search Central** (las reglas)

*El sistema sugiere, el usuario decide, Google ve siempre la misma URL para el mismo contenido.*

### Reglas no negociables

```
URL        /{es|pt|en}/tienda/{slug}/...     idioma en la URL, país en el Market
Idioma     cookie > Accept-Language > país (no bots) > es
Redirect   solo /tienda/... sin idioma, 307. Una URL con idioma NUNCA redirige
Indexa     solo el idioma primario de la tienda (countryCode) hasta Fase 2
Errores    NOT_FOUND → 404 · cualquier otra falla → 5xx (Google conserva el índice)
```

Ver `architecture/10-seo-i18n-norte.md`, `decisions/ADR-016-seo-i18n-global.md`
y `contracts/seo-i18n.md`. Esto completa el pendiente "Idioma por Market" de ADR-014.

<!-- ADR-018 -->
---

## Dependencias — política única (ADR-018)

### El norte

**Google** (una versión, dueño, strict deps) · **Microsoft Rush** (cero phantom deps) ·
**OpenSSF / SLSA** (cadena de suministro)

*Toda dependencia es código ajeno que corre con nuestros permisos: entra con dueño,
con una sola versión y declarada donde se usa.*

### Reglas no negociables

```
Versión    solo catalog: o workspace:*  — nada hardcodeado
Declarar   todo import externo está en el package.json del workspace que lo usa
Libs       packages/* → frameworks en peerDependencies, nunca en dependencies
Nueva dep  checklist R4 del norte en el PR + dueño asignado
Lockfile   --frozen-lockfile en CI y en Railway
```

Ver `architecture/11-dependencias-norte.md` y `decisions/ADR-018-politica-dependencias.md`.

---

## Contratos tRPC — `dist` como única fuente para los fronts (ADR-019)

### El norte

**Contrato real o no hay contrato**: un procedure con `any` o un `dist` escrito a mano vacía el tipado
extremo a extremo que justifica usar tRPC.

### Reglas no negociables

```
Build      pnpm --filter @real/trpc build emite los .d.ts de cada back a packages/trpc/dist/contracts
Orden      prisma generate -> @real/trpc build -> backs -> fronts
Fronts     leen SOLO de @real/trpc (dist); tipos de dominio inferidos, nunca escritos a mano
Backs      importan solo @real/trpc/markets (hoja sin ciclo)
Procedures prohibido `any`: TRPCProcedureBuilder con contexto nombrado (evita TS2883)
Fronts     sin ignoreBuildErrors; sin alias @/ dentro de packages/*
Docker     cada Dockerfile de front tiene un stage `contracts` que genera packages/trpc/dist
CI/local   `pnpm contracts` (prisma generate de ambos backs + @real/trpc build) tras `pnpm install`
```

**Pendiente:** `docker build` real de los 3 fronts (solo se simuló en un directorio limpio).
Ver `decisions/ADR-019-contratos-trpc-desde-dist.md` y `modules/packages/trpc.md`.

---

## Docs del ecosistema — contenido gestionado desde superadmin (ADR-020)

### El norte

**Stripe Docs** (experiencia) · **Diátaxis** (estructura) · **Google Dev Docs Style Guide** (redacción) ·
**Markdoc** (formato seguro) · **Sanity / Contentful** (modelo de CMS headless)

*El contenido es dato, no código: lo edita el superadmin, lo versiona el sistema y el front solo lo renderiza.*

### Reglas no negociables

```
Contenido  Markdoc en DB. Nunca MDX ni HTML crudo. Tags en whitelist
Estructura Toda página declara kind: tutorial | how-to | reference | explanation
Estados    draft -> published con versiones. El front solo lee published
Transporte Contrato REST interno de superadmin (x-internal-api-key), solo servidor
```

Front: `realsass-docs-front` (puerto 3024). Lee de superadmin (ADR-021); un ecosistema por deploy (`DOCS_ECOSYSTEM_ID`).
Ver `architecture/12-docs-norte.md` y `decisions/ADR-020-docs-front.md`.

---

## Calidad del monorepo — las reglas se verifican solas (ADR-022)

### El norte

**Una regla que no falla en CI no es una regla.**

### Reglas no negociables

```
TypeScript strict + noUncheckedIndexedAccess (backs, auth-server). Sin any, @ts-ignore ni as unknown as (salvo dobles de test)
Validación Zod es la ÚNICA librería (tRPC input() / ZodValidationPipe). Sin class-validator, class-transformer ni joi
Lint       `lint` nunca modifica código (lint:fix aparte). fetch solo en FETCH_ALLOWLIST (eslint.config.mjs)
Tests      spec al lado del archivo; cobertura con umbral que solo sube (jest.config.js); nunca contra una base real
CI         ci.yml: quality (contracts→lint→typecheck→build) + tests + pnpm audit + auditorías. Todo bloqueante
Deps       import externo declarado en su workspace (scripts/audit/phantom-deps.cjs). Sin shamefully-hoist
Repo       sin *.bak ni *PATCH.md. .env.make es local. Auditorías en scripts/audit/. Node en .nvmrc, pnpm en packageManager
Local      pnpm check (= lo que corre el CI) · make a (auditorías) · pnpm setup:hooks (pre-commit contra secretos)
```

Ver `decisions/ADR-022-calidad-monorepo.md`, `ADR-024-tests-y-validacion.md` y `roadmap/deuda-tecnica.md` (sesión 2026-10-14).

---

## Seguridad — lo que el cliente fabrica no es una credencial (ADR-023)

### El norte

**Nada que el cliente pueda fabricar es una credencial · todo falla cerrado · todo secreto es rotable.**

### Reglas no negociables

```
Identidad  customerId solo de la cookie HttpOnly store_session (firmada). Nunca de un header
Carrito    el sessionId del carrito es el customerId de la sesión (getOwnedCart)
Arranque   sin ALLOWED_ORIGINS, INTERNAL_API_KEY ni CUSTOMER_SESSION_SECRET el servicio NO levanta
CORS       lista explícita; "*" y origin:true prohibidos
Claves     identifyCaller / firstKey; INTERNAL_API_KEY: "nueva,vieja" (rotar) o "servicio=clave,…" (una por servicio)
Tienda     customer.identify solo para tiendas que existen y están abiertas
/trpc      rate limit por IP y por usuario, contador en Redis (los guards de Nest no cubren middlewares Express)
Servicios  timeout en toda llamada entre servicios; circuit breaker en las críticas
Verifica   scripts/audit/seguridad.sh (S1-S10) + los tests de seguridad (job "tests" del CI)
```

Ver `decisions/ADR-023-modelo-de-seguridad.md` (modelo de amenazas, rotación y riesgo residual).
Pendientes de diseño: `ADR-025` (cuentas recurrentes por email) y `ADR-026` (CSP con nonces).

---

## Aislamiento por fila — la base también filtra (ADR-027)

### El norte

**Dos capas independientes de aislamiento entre organizaciones: la aplicación (`where`) y la base (Row Level Security).**
*Si un `where` falta, la base devuelve vacío en lugar de datos ajenos.*

### Reglas no negociables

```
Políticas  ENABLE + FORCE ROW LEVEL SECURITY en toda tabla de negocio; tablas hijas heredan del padre
Default    sin alcance de tenant => 0 filas y escrituras rechazadas (olvidarse rompe fuerte, nunca filtra)
Alcance    lo fija TenantAwarePool en cada conexión; tRPC lo abre tras autorizar; fuera de una petición: runInTenant
Salida     runAsSystem(razón, fn) solo desde los archivos de la auditoría S8
Roles      migraciones = dueño (MIGRATION_DATABASE_URL) · servicio = eco_app sin BYPASSRLS (DATABASE_URL)
Arranque   NODE_ENV=production con un rol que saltea RLS => el servicio NO arranca
Mutaciones toda mutación tRPC sin sesión está en scripts/audit/public-mutations.allowlist (S10)
Verifica   seguridad.sh S8-S10 + rls.int-spec de cada back (con el rol eco_app) + mutación de las políticas
```

Cobertura: ecommerce-back completo; sass-back fase 1 (secretos, webhooks, cuotas, mercados); fase 2 pendiente.
Ver `decisions/ADR-027-row-level-security.md` y `architecture/13-seguridad-por-capa-norte.md` (criterio de 10/10 por capa).
Línea base de los 10 pilares del ecosistema con su puntaje y evidencia: `modules/pilares-audit.md` (documento vivo).
