# ADR-009: S4 — Tests 85% + CI Enforcement + HydrationBoundary

**Fecha:** 2026-09-02
**Estado:** Aceptado — S4-A y S4-B completados (2026-09-02)

## Contexto

Con Fase 1 cerrada y el código base en un promedio de 9.1/10 sobre 10 capas,
el único camino al 10/10 en todas las capas es el mismo conjunto de trabajo:
tests con cobertura mínima 85%, reglas de enforcement en CI, y el modelo
correcto de Server/Client Components con HydrationBoundary.

### Inventario completo de pendientes por capa

#### Backend — tests y enforcement

| Capa | Tests pendientes | Enforcement pendiente |
|------|-----------------|----------------------|
| 1 — Auth | FirebaseAuthGuard, TenantGuard, SessionService (unit) + integration cookies | dependency-cruiser: no-local-firebase-verify |
| 2 — Router | Supertest: input inválido → Zod error, sin cookie → 401, owner como collab → 403 | ESLint: no-new-class-validator + dependency-cruiser: no-rest-controller |
| 3+4 — Domain/Repo | Unit de domain entities (puras), unit de services mockeando IRepository | dependency-cruiser: no-prisma-in-service |
| 5 — AppRouter | GitHub Actions: typecheck 3 fronts en PR que toca trpc/ | — |
| 6 — Multi-tenant | Test cross-tenant: org A no retorna datos de org B | ESLint: no-unscoped-prisma-query |

#### Frontend — HydrationBoundary + tests + enforcement

| Capa | Pendiente |
|------|-----------|
| 1 — Fetch | HydrationBoundary en Server Components + ESLint: no-bare-fetch |
| 2 — TanStack | HydrationBoundary + prefetch server-side + ESLint: no-useeffect-fetch |
| 3 — Zustand | conventions/state.md ✅ + lint: campo en store que existe en queryKey |
| 4 — Presentación | RTL tests (3 estados) + Vitest utils + Playwright E2E |
| 5 — Auth | Tests login→cookie→logout + refresh + revocación cross-device |

#### Decisiones de degradación — tomadas en S4-A (2026-09-02)

Las 3 decisiones fueron tomadas y documentadas en `architecture/00-principios.md`.

**Decisión 1 — Firebase Admin SDK no disponible:**
Rechazar con 503 al arranque (crash intencional — el servicio no debe arrancar
sin poder verificar identidad). En runtime si Firebase cae: health check devuelve
`degraded`, no `down` — Railway no reinicia en `degraded`, el servicio sigue
procesando tokens ya verificados en cache.

**Decisión 2 — Health check con Firebase caído:**
Devuelve `degraded` (no `down`). La distinción es operacional: `down` dispara
reinicio en Railway; `degraded` alerta sin reiniciar. Firebase caído en runtime
no justifica reinicio — el servicio sigue funcionando con cache.

**Decisión 3 — OrganizationsClientService tarda > 2s:**
Depende del endpoint. Checkout y admin dashboard → 503 siempre (datos organizacionales
sensibles, seguridad > disponibilidad). Catálogo público del storefront → continuar
con cache vencida + log warning (sin datos sensibles, disponibilidad > seguridad estricta).
El timeout de 2s ya configurado es correcto — lo que varía es la acción post-timeout.

**Decisión 4 — Servicios futuros (chat-ia-back, pagos-back):**
chat-ia-back: timeout 2s + 503 (mismo patrón que admin).
pagos-back: timeout 5s + 503 (SLA distinto — transacciones financieras toleran
más latencia; un pago que tarda 4s es preferible a un 503).

Ver detalle completo en `architecture/00-principios.md` sección "Degradación y resiliencia".

## Decisión

**Implementar S4 en este orden exacto:**

### Fase S4-A — Decisiones de degradación ✅ (2026-09-02)

Tomadas y documentadas en `architecture/00-principios.md`.
Ver sección "Degradación y resiliencia entre servicios".

### Fase S4-B — conventions/state.md ✅ (2026-09-02)

Documentado en `.claude/conventions/state.md` — Zustand vs TanStack Query.
Desbloquea el enforcement de Capa 3.

### Fase S4-C — GitHub Actions CI (1-2 sesiones)

Crear los 7 workflows de GitHub Actions (E5-01 a E5-07) + branch protection.
Orden: primero los que corren typecheck (valor inmediato), luego los que
corren tests (valor diferido hasta que existan tests).

```
.github/workflows/
  realsass-sass-back.yml       → pnpm typecheck + pnpm build
  realsass-ecommerce-back.yml  → pnpm typecheck + pnpm build
  realsass-sass-front.yml      → pnpm typecheck + pnpm build
  realsass-dashboard-front.yml → pnpm typecheck + pnpm build
  real-ecommerce-front.yml     → pnpm typecheck + pnpm build
  packages.yml                 → typecheck de auth-server y trpc
  trpc-contract.yml            → typecheck 3 fronts cuando cambia trpc/
```

### Fase S4-D — HydrationBoundary (1-2 sesiones)

Implementar el modelo correcto de Server/Client Components en las páginas
principales de los 3 fronts. Patrón:

```tsx
// page.tsx (Server Component)
const queryClient = new QueryClient()
await queryClient.prefetchQuery({
  queryKey: trpc.catalog.list.queryKey({ organizationId }),
  queryFn:  () => createServerCaller().adminCatalog.list({ organizationId }),
})
return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ProductList />
  </HydrationBoundary>
)

// ProductList (Client Component)
const { data } = trpc.adminCatalog.list.useQuery({ organizationId })
// rehidrata desde server — sin loading flash inicial
```

Páginas prioritarias:
- `dashboard-front/app/dashboard/tienda/productos/page.tsx`
- `dashboard-front/app/dashboard/tienda/pedidos/page.tsx`
- `sass-front/app/profile/page.tsx`
- `ecommerce-front/app/tienda/[slug]/productos/page.tsx`

### Fase S4-E — Tests backend (2-3 sesiones)

Orden por valor decreciente:

1. **Tests de cross-tenant** (Capa 6) — tests de seguridad, no de funcionalidad.
   Un test que confirma que org A no retorna datos de org B es la única prueba
   real de que el sistema es multi-tenant correcto.

2. **Tests de domain entities** (Capa 3+4) — funciones puras, sin mocks.
   `validateProductDraft`, `assertValidHandle`, `assertNoDuplicateSkus`.
   Son los tests más baratos de escribir y los más valiosos para detectar regresiones.

3. **Tests de contracts HTTP/tRPC** (Capa 2+5) — Supertest contra los routers.
   Input inválido → Zod error tipado. Sin cookie → 401. Owner-only → 403.

4. **Tests de auth guards** (Capa 1) — mockeando Firebase Admin SDK.
   Token válido, expirado, revocado. Cookie presente/ausente.

5. **Tests de integración auth** (Capa 5 frontend) — login→cookie→logout.
   Requiere setup de testing con cookies HttpOnly.

### Fase S4-F — Tests frontend (1-2 sesiones)

1. **Vitest unit tests** — funciones de utilidad: `formatPrice`, `getErrorMessage`,
   `selectCarrier`, `generateSessionId`.

2. **React Testing Library** — componentes críticos con los 3 estados:
   - `collaborators-section.tsx` — loading/error/data
   - `app/profile/page.tsx` — skeleton/error/overview
   - `dashboard/tienda/productos/page.tsx` — loading/error/tabla

3. **Playwright E2E** — flujos completos:
   - Flujo de invitación: sass-front → invite → dashboard-front SSO
   - Flujo de compra: ecommerce-front → carrito → checkout

### Fase S4-G — Enforcement CI (1 sesión)

Una vez que los tests existen, agregar las reglas de enforcement:

**ESLint rules custom (`@real/`):**
- `no-new-class-validator` — bloquea DTOs con class-validator
- `no-bare-fetch` — bloquea fetch sin `// @real/exception:`
- `no-useeffect-fetch` — bloquea useEffect con fetch de datos
- `no-inline-mock-data` — bloquea arrays > 2 objetos en componentes
- `no-unscoped-prisma-query` — bloquea queries sin organizationId

**dependency-cruiser rules:**
- `no-local-firebase-verify` — Firebase solo en @real/auth-server
- `no-prisma-in-service` — PrismaService solo en repositories
- `no-rest-controller-in-business-module` — controllers solo en trpc/

## Alternativas descartadas

**Alternativa 1: Implementar S4 todo junto en una sesión grande**
Descartado — S4 tiene ~40 tasks de naturaleza muy distinta. Las fases S4-A a S4-G
permiten foco real en cada tipo de trabajo.

**Alternativa 2: Empezar por tests antes que CI**
Descartado — sin CI los tests no tienen enforcement. El orden CI → tests → enforcement
asegura que cada pieza refuerza a la siguiente.

**Alternativa 3: Implementar solo algunos tests para "llegar a 10/10"**
Descartado — el score 10/10 no es una meta cosmética. Tests con 85% en paths
críticos es el criterio real.

**Alternativa 4: HydrationBoundary en todas las páginas a la vez**
Descartado — implementarlo en 4 páginas prioritarias primero crea el molde.
Sin molde establecido la calidad es inconsistente.

## Consecuencias

**Al completar S4:**
- Todas las capas en 10/10 (excepto Capa 4 por dependencias externas)
- Un PR que rompe un contrato tRPC no puede mergearse
- Un query sin organizationId en el where falla en CI antes de llegar a producción
- El modelo Server/Client Components es consistente en los 3 fronts
- La documentación de degradación existe antes del primer incidente en producción

**Capa 4 — Presentación:**
El score 7/10 es el techo real sin `pagos-back` y sin APIs de courier.
S4-F sube Capa 4 a ~8.5/10. El 10/10 de Capa 4 requiere `pagos-back`.

**Costo:**
- S4 completo: ~8-12 sesiones de trabajo
- El orden importa: CI antes que tests, molde antes que escala

## Orden de ejecución

```
S4-A: ✅ Decisiones de degradación → architecture/00-principios.md (2026-09-02)
S4-B: ✅ conventions/state.md — Zustand vs TanStack documentado (2026-09-02)
S4-C: ⏳ GitHub Actions 7 workflows → CI gate en main
S4-D: ⏳ HydrationBoundary 4 páginas → molde Server/Client Components
S4-E: ⏳ Tests backend (cross-tenant → domain → contracts → auth)
S4-F: ⏳ Tests frontend (Vitest → RTL → Playwright)
S4-G: ⏳ ESLint + dependency-cruiser rules
```

## Referencias

- `.claude/checklists/` — pendientes por capa
- `.claude/architecture/00-principios.md` — decisiones de degradación S4-A
- `.claude/conventions/state.md` — Zustand vs TanStack S4-B
- `.claude/lifecycle/02-fase-estabilizacion.md` — Escalones 3, 5, 6
- `.claude/conventions/testing.md` — stack de testing
- `decisions/ADR-004-auth-session-cookies.md` — contexto de tests de auth
- `decisions/ADR-007-eliminar-any.md` — toEntity() como base para tests de domain
