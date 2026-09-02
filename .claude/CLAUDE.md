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
