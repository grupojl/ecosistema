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
