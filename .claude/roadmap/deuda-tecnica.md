# Deuda técnica — welver

Última actualización: 2026-10-15

---

## Sesión 2026-10-15 (2) — Seguridad por capa: RLS, markets, checkout (ADR-027)

### Cerrado ✅ (verificado en esta sesión)
- [x] **Row Level Security** (ADR-027). ecommerce-back completo; sass-back fase 1 (secretos, webhooks + log, cuotas, mercados).
  `TenantAwarePool` + `withTenantScope` en tRPC + `runInTenant`/`runAsSystem`; rol `eco_app` sin `BYPASSRLS`; el servicio no
  arranca en producción con un rol que saltea RLS. Probado contra Postgres 16 real con `eco_app`: 15 casos en ecommerce-back
  y 14 en sass-back; con el rol administrador fallan 12 de 14 (los tests sí prueban la base).
- [x] **Vulnerabilidad real: `sass-back` `markets.create/update/setDefault/delete` eran públicos** y aceptaban la organización o el
  id por input (cualquiera podía crear, cambiar o borrar mercados ajenos). Ahora `ownerProcedure` con la organización del
  contexto + verificación de pertenencia por id. `markets.resolve` exigía `x-internal-api-key` pero **nadie la validaba**:
  ahora `internalProcedure`. Fronts actualizados (`list` ya no recibe `organizationId`).
- [x] **`deleteAccount` inseguro** (público, anonimizaba cualquier cuenta con solo `customerId`): era código muerto pero figuraba como
  hecho. Borrado y reemplazado por `customer.deleteAccount` autenticado (el id sale de la sesión firmada).
- [x] **Stock**: `PrismaInventoryRepository.reserve/release` atómicos (UPDATE condicional). 20 reservas simultáneas por 1 unidad con
  stock 5 => exactamente 5 ganan.
- [x] **Checkout idempotente**: el carrito se reclama con un UPDATE atómico; 20 checkouts simultáneos del mismo carrito => 1 orden
  y stock reservado una vez; un reintento devuelve la misma orden; otro cliente no la recupera. Se probó con mutación (6/6 fallan
  sin el reclamo).
- [x] **Rate limit**: probado con dos instancias reales sobre Redis (comparten el contador; el control en memoria lo duplica).
  Si el store falla, el middleware degrada a un límite local por instancia en lugar de dejar pasar todo.
- [x] **BullMQ**: entrega de webhooks de punta a punta (Redis + Postgres + receptor HTTP reales): firma HMAC verificable,
  reintentos con backoff, agotamiento tras 3 intentos, aislamiento por organización, el job no lleva secreto ni URL.
- [x] **Mutación manual de `enforceOwner`** (pendiente del ADR-024): con el guard debilitado fallan 36 tests en sass-back (1 en
  ecommerce-back, donde ningún router usa `ownerOnlyProcedure` todavía).
- [x] **`docker build` de los 5 servicios** (exit 0; 205 MB, 210 MB y ~82 MB los fronts).
- [x] **Test de humo del storefront** (home, listado y layout ejecutados con el resolver real) + guard estático de la frontera
  servidor/cliente. Probado con mutación (`useStore()` reintroducido => 5 tests fallan).
- [x] Auditorías nuevas en `seguridad.sh`: **S8** (`runAsSystem`), **S9** (RLS cableado e idéntico en ambos backs), **S10**
  (mutaciones públicas en lista explícita; detecta el bug original de markets). C5 ahora excluye `*-spec.ts`.
- [x] Cobertura unitaria: sass-back 67 % -> 73 % (478 tests), ecommerce-back 70 % -> 75 % (330 tests); umbrales subidos a 72 y 73.
- [x] CI: el job `integration` crea el rol `eco_app`, migra con el administrador y corre los specs de RLS con `eco_app`.

### Pendiente ⏳ (honesto)
- [ ] **RLS fase 2 en sass-back**: collaborators, invitations, users, organizations, affiliate_data y las tablas con filas globales
  (theme_configs, feature_flags, content_templates, config_audit_logs). Se consultan antes de conocer la organización o mezclan
  filas globales y propias: necesitan políticas distintas y revisar el flujo de login (ver ADR-027).
- [ ] **RLS no probado en Railway.** Falta: crear el rol `eco_app` en cada base, definir `MIGRATION_DATABASE_URL` y `DATABASE_URL`,
  y comprobar en los logs que no aparece el aviso de rol que saltea RLS. Medir la latencia del `set_config` por conexión.
- [ ] **Nada de esto corrió en el CI de GitHub** ni hay branch protection.
- [ ] **Los contenedores no se levantaron** (solo se construyeron las imágenes).
- [ ] **CSP con nonces (ADR-026)**: no se implementó a propósito: obliga a render dinámico (pierde ISR en el storefront) y solo se
  valida en un navegador real.
- [ ] **Pagos**: sigue sin existir el servicio; `paymentIntentId` es null. Cuando exista: idempotencia con el proveedor,
  confirmación por webhook entrante firmado y transiciones de estado en un solo sentido.
- [ ] **E2E con Playwright** (login y checkout en un navegador): no hecho.
- [ ] Los eventos `config.flag.updated` / `config.theme.activated` que se emiten no coinciden con los `@OnEvent('config.flag.changed')`
  del despachador de webhooks: hoy esos cambios no disparan webhooks. Detectado, sin corregir.
- [ ] Rate limit más estricto y progresivo por cuenta en login/registro.
- [ ] Backups, alertas y runbook operativo sin definir.

---

## Sesión 2026-10-15 — Integración contra Postgres real

### Cerrado ✅
- [x] [WEL-01] Migraciones verificadas contra Postgres 16 limpio: `migrate deploy` aplica las de ambos backs y `migrate diff` da "No difference detected" contra `schema.prisma`. Ahora lo vigila el CI.
- [x] [DT-Q-16] Test de concurrencia contra Postgres real: 20 checkouts simultáneos por 1 unidad con stock 5 → exactamente 5 ganan, stock final 0 / reservado 5; pedir de más no deja stock negativo; una transacción que falla revierte la reserva.
- [x] Tests de aislamiento entre tenants con base real (`src/__tests__/integration/tenant-isolation.int-spec.ts`, 9 en ecommerce-back y 7 en sass-back): catálogo, inventario, órdenes, feature flags (incluye que ni una org puede editar un flag global), temas y webhooks.
- [x] Job `integration` en `ci.yml` (Postgres como servicio, migraciones, deriva, `pnpm test:int`). **Agregarlo a los jobs exigidos en la branch protection.**
- [x] 10 specs vacíos de entidades (`*.entity.spec.ts`, 30 `it.todo`) borrados: las entidades son interfaces, no hay lógica que probar.

### Cobertura de sass-back (DT-Q-17, parte 1) ✅
- [x] Cobertura unitaria **32/20/31/32 → 56/40/50/56** (líneas/funciones/ramas/sentencias); umbral en `jest.config.js` subido a 55/39/49/55. 27 suites, 339 tests (antes 174).
- [x] Specs nuevos de los services de config con repositories falsos: webhooks (anti-SSRF, secreto mostrado una sola vez y guardado cifrado), secrets (valor nunca en claro ni en auditoría), themes, flags, quotas, templates y affiliate.
- [x] `src/trpc/authorization.spec.ts` (101 tests, routers REALES): sin sesión ⇒ 401, sin organización ⇒ 400, header de org sin membresía ⇒ 403, **colaborador en procedures de dueño ⇒ 403 sin tocar el service** (los services son dobles que explotan si se los alcanza), la organización sale del contexto y no del input, traducción de errores de negocio. Con control positivo (el dueño sí pasa). Cubre el "colaborador sin permiso recibe 403" del checklist de capa 6.
- [x] Bug de proceso: `config-themes.router.ts.bak2` seguía versionado (el pre-commit solo frena archivos nuevos). Borrado, y la auditoría `arquitectura.sh` tiene el check **A8** (sin `*.bak*`, `*.orig`, `*.rej`, `*PATCH.md` versionados).
- [x] Auditorías ajustadas con criterio, sin aflojar lo que importa: `testing.sh` E1 exige spec solo a los archivos de `domain/` que exportan código ejecutable (los 10 con lógica lo tienen); `contratos-tipado.sh` B2 reconoce `*-spec.ts` (integración/e2e) como tests, donde `as unknown as` está permitido para dobles.
- [ ] Quedan sin tests unitarios: `redis.service` (9 %), `health.controller`, `internal-organizations.controller` (clave de servicio), `auth-session-throttled.controller`, `claims.service`, ramas de `markets.service` y `trpc.ts` (61 %). Los repositories Prisma los cubre la integración, que **no** cuenta en el umbral unitario: evaluar medir su cobertura aparte.
- [ ] La mutación manual de `enforceOwner` (ADR-024) no se ejecutó: el entorno bloqueó correr tests con el guard debilitado. Se mitigó con un control positivo; queda por hacer a mano.

### Cobertura (parte 2) y Redis ✅ / 🔶
- [x] Cobertura unitaria: **sass-back 67 % de líneas** (67/51/59 sentencias-funciones-ramas; 37 suites, 423 tests) y **ecommerce-back 70 %** (70/60/64; 21 suites, 278 tests). Umbrales subidos a 66/50/58/66 y 69/58/63/69. **0 `it.todo`** en todo el monorepo.
- [x] Nuevos specs en sass-back: `RedisService` (no-op, reintentos, Lua atómico, JSON corrupto), `health` (ok/degraded/down), `InternalApiKeyGuard` (401, rotación, clave por servicio, y regresión: el controller conserva el guard), controller interno, sesión con throttle (regresión: 10 req/min), `ClaimsService`, **`enforceStepUp` y `StepUpGuard`** (ventana de 5 min, sesión vieja con cookie renovada), `ConfigCacheService`, `UsersService`, contexto y formateador de errores de tRPC (en producción un 500 no expone el mensaje).
- [x] Nuevos specs en ecommerce-back: `src/trpc/authorization.spec.ts` (47 tests con los routers reales: admin/dueño/cliente, sesión de la tienda A no sirve en la B, control positivo), `RedisService`, `MarketResolverService`.
- [x] **Dos bugs reales corregidos al escribir los tests**: `ConfigCacheService.get` (sass-back) y `MarketResolverService.resolveMarket` (ecommerce-back) hacían `JSON.parse` sin protección sobre el caché: una entrada corrupta en Redis rompía la lectura (y el checkout). Ahora se tratan como "no está en caché".
- [x] Borrados los dos `cross-tenant.spec.ts` (8 `it.todo`): los 4 casos están cubiertos por la integración y las matrices de autorización.
- [x] **Tests de Redis real** (`redis.int-spec.ts` en ambos backs): TTL que vence, contador Lua atómico (50 incrementos concurrentes ⇒ exactamente 1..50), ventana fija, contador **compartido entre dos réplicas**, invalidación de caché por organización, health con Redis real, caché del resolver. Se saltean con aviso si falta `TEST_REDIS_URL`; en el CI es **obligatoria** y el job `integration` tiene un servicio Redis. **Ejecutados el 2026-10-15 contra Redis 7 y Postgres 16 reales en Docker: 16/16 en cada back, estables en 3 corridas repetidas** (el primer intento tuvo 3 fallos de un helper mío con `import()` dinámico, no del código).
- [ ] Fallo aislado visto una vez en una corrida en frío (`trpc-context.spec` y `config-themes.service.spec` marcadas FAIL; 402 de 423 tests); 5 corridas posteriores y la verificación completa pasaron limpias. No reproducido: si reaparece, capturar la salida completa.
- [ ] Siguen sin cubrir (unitarios): `markets.service` (ramas), `app-router`, `auth.router`, `config-webhooks.router`, `instrumentation.ts` y los repositories Prisma (los cubre la integración, que no cuenta en el umbral unitario).
- [ ] Docker + Redis pendientes: BullMQ con Redis real (entrega de webhooks con reintentos), rate limit de `/trpc` entre dos instancias de la app y `docker build` de los 5 servicios.

### Cómo correr la integración en local
```bash
docker run -d --name eco-test-pg -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
docker exec eco-test-pg psql -U test -c "create database sass_test" -c "create database ecommerce_test"
docker run -d --name eco-test-redis -p 56379:6379 redis:7-alpine     # opcional en local, obligatorio en el CI
# aplicar migraciones (DATABASE_URL explícita: NUNCA la del .env, apunta a Railway)
DATABASE_URL=postgresql://test:test@localhost:55432/sass_test pnpm --filter realsass-sass-back exec prisma migrate deploy
DATABASE_URL=postgresql://test:test@localhost:55432/ecommerce_test pnpm --filter realsass-ecommerce-back exec prisma migrate deploy
TEST_DATABASE_URL=… TEST_REDIS_URL=redis://localhost:56379 pnpm --filter <back> run test:int   # se niega a correr si las URLs no son locales
```

### Pendiente derivado
- [ ] Borrar `src/__tests__/security/cross-tenant.spec.ts` en ambos backs (4 `it.todo` cada uno): los 4 casos de sass-back están cubiertos (integración + `authorization.spec.ts`); en ecommerce falta el equivalente 401/403 de `adminProcedure`/`ownerOnlyProcedure`/`customerProcedure`.
- [ ] [DT-Q-17] Seguir: tests de los routers de ecommerce-back, repositories de users/collaborators/markets (integración) y los controllers listados arriba.
- [ ] `PrismaInventoryRepository.reserve` hace leer-modificar-escribir sin atomicidad; hoy nadie lo llama (el checkout usa `reserveWithinTransaction`). Borrarlo o volverlo un UPDATE condicional.

---

## Sesión 2026-10-14 — Calidad, seguridad y tests (ADR-022, 023, 024)

### Cerrado ✅
- [x] Backs con `strict` + `noUncheckedIndexedAccess`, `module`/`moduleResolution` node16 sin `baseUrl` ni `ignoreDeprecations`; sin `any`, sin `require()` y sin `as unknown as` fuera de los dobles de test.
- [x] `lint` sin `--fix` (`lint:fix` aparte), ignora `src/generated`; regla `no-restricted-globals: fetch` + `FETCH_ALLOWLIST` en los 4 fronts. 0 errores y 0 warnings en los 6 workspaces. `typecheck` real en todos los paquetes.
- [x] `pnpm audit`: 24 vulnerabilidades (3 críticas) → 0. `overrides` consolidados (una regla por paquete/major).
- [x] Dependencias fantasma → 0 (`scripts/audit/phantom-deps.cjs`, ahora también sobre `generated/`): `@types/pg`, `@prisma/client-runtime-utils`, `eslint`+plugins, `firebase`, `@types/express`, `zod`, `webpack-node-externals`.
- [x] Catálogo depurado (`bull`, `bcrypt`, `@nestjs/jwt`, `@trpc/next`, `keyv`, `resend`, `uuid`, `joi`, `class-validator`, `class-transformer` y sus `@types`). **Zod única validación**: se quitó el `ValidationPipe` global (inerte).
- [x] `shamefully-hoist` fuera de `.npmrc` y de los 5 Dockerfiles (el runtime copia los `node_modules` del servicio; `entrypoint.sh` busca `prisma` en el `.bin` del servicio). Verificado en clon limpio: build + arranque de backs y fronts.
- [x] Repo: 33 `*.bak`/`*PATCH.md` borrados, `.env.make` pasó a local (plantilla `.env.make.example`), auditorías en `scripts/audit/`, `.editorconfig`, `.gitattributes`, `.nvmrc`, `packageManager`, hook de pre-commit contra secretos (`pnpm setup:hooks`).
- [x] [WEL-05] 15 workflows → `ci.yml` (quality, tests, dependencies, audits) + `secrets.yml` (gitleaks) + Dependabot (el que ya existía se conservó).
- [x] [DT-Q-02 / A1] Prisma directo → repositorio en `auth.service`, `webhook-delivery.service`, `internal-organizations.service`.
- [x] [DT-Q-03 / A3] `firebase-admin` directo en sass-back → `getFirebaseAdmin()` de `@real/auth-server`.
- [x] [DT-Q-04 / ADR-005] `dashboard-front/lib/api-client.ts` eliminado (sus clientes REST apuntaban a endpoints que ya no existen); queda `lib/external-client.ts` solo para campañas/pagos. `sass-front/auth-context` usa un cliente tRPC tipado.
- [x] [DT-Q-05 / ADR-014] El checkout guarda `marketId`, `visitorCountryCode` y `fulfillmentSnapshot` en la orden, y `subtotal + envío = total`.
- [x] [DT-Q-06] Tests: config de jest única en ambos backs y en `@real/auth-server`; 3 suites + 1 de scripts (ver ADR-024). `audit testing` en 0.
- [x] [DT-Q-08 / ADR-023] Seguridad: sesión firmada del cliente en cookie HttpOnly, carrito atado a su dueño, CORS fail-closed, claves de servicio rotables y por servicio, rate limit sobre `/trpc` (Redis), `trust proxy`, timeouts + circuit breaker, errores sin detalles, cabeceras en los 4 fronts, `identify` solo para tiendas abiertas, pre-commit contra secretos.
- [x] Bugs reales corregidos al escribir los tests (tabla en ADR-024): `RolesGuard` fallaba abierto, bypass del anti-SSRF por IPv6, re-aceptación de invitaciones por colaboradores removidos, token SSO para colaboradores removidos, errores 500 en lugar de 404/409/422 en ecommerce, breaker abierto por 403, cifrado multibyte, importes de la orden.

### Pendiente
- [ ] [DT-Q-07] GitHub: correr el CI una vez (no hay acceso desde acá), activar branch protection exigiendo los 4 jobs, y definir `GITLEAKS_LICENSE` si el repo es de una organización (lo es: `grupojl/ecosistema`).
- [ ] [DT-Q-11] **`docker build` real de los 5 servicios** (sin Docker en la máquina de desarrollo): validar el layout nuevo antes de mergear a la rama de deploy.
- [ ] [DT-Q-10] **Antes de desplegar ecommerce-back**: definir `CUSTOMER_SESSION_SECRET` y `ALLOWED_ORIGINS`; tu `.env` local también necesita `CUSTOMER_SESSION_SECRET` (`openssl rand -hex 32`) o el servicio no arranca. `COOKIE_DOMAIN` compartido con el storefront. Los carritos en curso se pierden.
- [ ] [DT-Q-12] ADR-025: cuentas recurrentes (verificación por email). Requiere proveedor de email + decisión de producto.
- [ ] [DT-Q-13] ADR-026: CSP con nonces. Requiere validar en un navegador (login, checkout) y un período en Report-Only.
- [x] [DT-Q-14] El envío ya no lo manda el cliente: `customer.checkout` ignora `shippingCents` y lo toma de `fulfillmentConfig.shippingCents` (tarifa plana del Market, validada con Zod en sass-back). Sin tarifa → 0. Test: el cliente no puede fijarlo.
- [x] [DT-Q-15] `collaborators.getInvitationInfo` (público) devuelve `getPublicInvitationInfo`: `expiresAt`, `used`, email del invitado y nombre de la organización. Sin ids ni token.
- [x] [DT-Q-16] Stock: `quantity_available` es neto de reservas (reservar resta, liberar suma, catálogo y `setStock` lo leen tal cual). El guard de `reserveWithinTransaction` pasó de `available - reserved >= n` a `available >= n` (descontaba dos veces). Cubierto por test del SQL. **Falta** un test de concurrencia contra Postgres real (DT-Q-17).
- [ ] [DT-Q-17] Cobertura de sass-back 33 %: repositories Prisma y routers (Postgres efímera en el CI); e2e del storefront/dashboard (Playwright).
- [x] [DT-Q-19] Auditoría C4: `prisma-internal-organizations.repository.ts` agregado a las excepciones (cross-tenant por diseño). `run.sh --ci`: sin hallazgos.
- [x] [DT-Q-18] `UsersService.upsertUser` / `repo.upsert` no tenían callers: borrados (el alta usa `AuthService` con código aleatorio).

---

## Sesión 2026-10-10 — Flujo del dueño, dashboard y storefront

Ver `domain/flows/owner-organizacion.md` §10, §10 bis y §10 ter. Además, en el storefront:

- [x] **ecommerce-back montaba tRPC en `/api/v1/api/v1/trpc`**: `setGlobalPrefix('api/v1')` también se antepone a `forRoutes()` de middleware, así que `forRoutes('/api/v1/trpc')` quedaba duplicado. Todos los clientes llaman a `/api/v1/trpc` → 404 ("Unable to transform response from server"). Ahora `forRoutes('/trpc')`.
- [x] **real-ecommerce-front**: 4 páginas (Server Components) llamaban a `useStore()`, un hook de contexto de cliente ("Attempted to call useStore() from the server"). Reemplazado por `requireStore(slug)` (comparte el `cache()` de `resolveStore`). El typecheck no lo detectaba: **falta un test de render de las páginas del storefront**.
- [ ] [DT-TEST-02] Test de humo del storefront (home, productos, 404) y del montaje de rutas de ecommerce-back.

---

## Sesión 2026-10-08 — Contratos desde `dist` + dashboard-front (ADR-019)

### Cerrado ✅

- [x] **`@real/trpc` con contrato real**: `build` emite los `.d.ts` de ambos backs a `dist/contracts/`; se
  eliminó el stub `SassAppRouter = any`. Hoja `@real/trpc/markets` para que los backs no dependan del contrato.
- [x] **Sin `any` en procedures** (`trpc.ts` de sass-back y ecommerce-back): builders anotados con
  `TRPCProcedureBuilder` + contextos con nombre (evita TS2883).
- [x] DTO de templates y webhooks pedían `organizationId` al cliente (lo inyecta el service) — tipados con `Omit`.
- [x] Router de temas de sass-back: `list` / `create` / `activate` / `remove` (antes `list` devolvía un tema y
  `update` solo activaba).
- [x] `packages/auth-client`: `api-fetch.ts` sin alias `@/`; `getFirebaseAuth` exportado.
- [x] `pnpm install` roto: se quitó `@nestjs-modules/ioredis@^3.0.0` (versión inexistente, sin uso en `src`) y se
  declaró `@types/qs` en ecommerce-back.
- [x] **realsass-dashboard-front: typecheck y build en verde, sin `ignoreBuildErrors`.**
  - módulo Tienda migrado a tRPC (`features/store/hooks.ts`), con alta/edición de producto, stock por variante
    y detalle de pedido;
  - páginas de config alineadas al contrato (flags, quotas, tema, webhooks);
  - `auth-context.tsx` tenía `'use client'` en la línea 6 (rompía el build);
  - eliminados `features/store/api.ts` y 4 componentes iPhone/Mac huérfanos.

### Cerrado en la segunda mitad de la sesión ✅

- [x] **[DT-CONTRATO-01] Docker de los fronts**: stage `contracts` en los 3 Dockerfiles + `.dockerignore` raíz.
  Verificado simulando los stages en un directorio limpio (los 3 fronts).
- [x] **[DT-CONTRATO-02] CI**: script raíz `pnpm contracts`, ejecutado tras `pnpm install` en los 15 workflows.
- [x] **[DT-CONTRATO-03] `sass-front` y `real-ecommerce-front`**: typecheck y build en verde contra el contrato
  real; `ignoreBuildErrors` eliminado de `real-ecommerce-front` (= DT-SEO-07). Archivos truncados
  (`navbar.tsx`, `auth-provider-wrapper.tsx` sin la `}` final), `useAuth`/perfil, carrito (`customer.cart.*`) y
  markets alineados al contrato.
- [x] **[DT-CONTRATO-04] `configThemes.getPublicTheme`**: procedure público por `orgSlug` en sass-back.
- [x] `@real/auth-client`: `signInWithApple`, `signInWithFacebook`.
- [x] Bug latente: `collaborators.service.ts` usaba `import("@prisma/client").Prisma` (cliente por defecto que
  no existe: el schema genera en `src/generated/prisma`); solo compilaba por un `@prisma/client` viejo local.
- [x] Docker de los backs: `CMD ["dumb-init", …]` tenía un `]` suelto (ejecutaba una ruta inexistente).

### Cerrado — build de fronts y variables de entorno ✅

- [x] `real-ecommerce-front`: `middleware.ts` → `proxy.ts` (Next 16), comportamiento verificado (307 con
  `Vary`, `Cache-Control` y `X-Locale-Source`).
- [x] `SITE_URL`: `robots.ts` pasó a `force-dynamic`; `ARG/ENV SITE_URL` en el Dockerfile para el build;
  verificado que `robots.txt` agrega `Sitemap:` leyendo la variable en runtime.
- [x] `realsass-sass-front` no tenía `output: 'standalone'` pero su Dockerfile copia `.next/standalone`
  (la imagen no podía construirse). Corregido y verificado arrancando `server.js` en los 3 fronts.
- [x] Dockerfile del dashboard no declaraba `NEXT_PUBLIC_REAL_BACK_URL`, `CHAT_IA_URL`, `CAMPANAS_URL`, `PAGOS_URL`
  (quedaban `undefined` en el build); storefront: `ORGANIZATION_ID` y `SITE_URL`.
- [x] `.env.example` completo (con comentarios, requerida/opcional y defaults reales) en los 5 servicios.
  `real-ecommerce-front/.gitignore` ignoraba `.env*` incluido el example (nunca estuvo versionado).
- [x] `next dev` de los 3 fronts usaba el puerto 3000 (choque con sass-back): ahora 3001 / 3002 / 3003.
- [x] Comentario obsoleto `SESSION_COOKIE_SECRET` en el Dockerfile de sass-back (el código no la lee).

### Cerrado — errores de Railway y de arranque de los contenedores ✅ (2026-10-08)

El primer deploy en Railway falló en los 5 servicios con `dockerfile invalid: flag '--mount=type=cache,id=…' is
missing the cacheKey prefix`. Corregirlo destapó fallos que solo se ven al ejecutar la imagen; se reprodujeron
emulando el runtime del Dockerfile (`node_modules` un nivel arriba) y se verificaron después del arreglo:

- [x] **Cache mounts de pnpm**: Railway exige `id=s/<id-del-servicio>-…` y un Dockerfile no conoce ese id. Se quitaron
  los 8 `RUN --mount=type=cache` (5 servicios + 3 stages `contracts`); el build reinstala dependencias cada vez.
  Las plantillas `architecture/05-dockerfile-backend.md` y `06-dockerfile-frontend.md` todavía los muestran
  (contratos inmutables: no se tocaron).
- [x] **pnpm sin versión en los 5 Dockerfiles**: `ARG PNPM_VERSION` estaba declarado solo antes del primer `FROM`,
  así que dentro de cada stage `${PNPM_VERSION}` quedaba vacío y Railway usó pnpm 12.10.1 (`pnpm@*`) en vez del
  10.30.3 previsto. Con pnpm 12 fallaban el stage `contracts` (corría `prisma generate` del `postinstall`) y el
  stage `deps` (`ERR_PNPM_IGNORED_BUILDS`). Re-declarado en cada stage. Verificado en directorio limpio con
  `pnpm@10.30.3` real: instalación de ambos stages, `@real/trpc build` y `next build` pasan.
- [x] **Backs — `entrypoint.sh`** usaba `node_modules/.bin/prisma` pero `node_modules` está en `/app/node_modules`:
  ahora agrega `../node_modules/.bin` al PATH. Reproducido (`No such file or directory`) y verificado.
- [x] **Backs — `prisma.config.ts`** no se copiaba al runtime (con Prisma 7 la URL de la base sale de ese archivo).
- [x] **Backs — `entrypoint.sh` no ejecutable** (modo git 100644): el `CMD` lo invoca con `sh`.
- [x] **sass-back no arrancaba** (nunca había corrido compilado): `AuthModule` no importaba `AffiliatesModule`;
  `TrpcModule` no importaba `ConfigTemplatesModule` ni `AffiliatesModule`; se perdió `BullModule.forRoot`.
  Ahora: "Nest application successfully started" desde el layout de la imagen.
- [x] ecommerce-back verificado: arranca desde el layout de la imagen ("Nest application successfully started").

### Pendiente — variables de entorno

- [x] [DT-ENV-01] dashboard unificado en `NEXT_PUBLIC_SASS_BACK_URL` (igual que sass-front). Si tenés un `.env.local` viejo con `NEXT_PUBLIC_REAL_BACK_URL`, renombrarlo; en Railway cambiar la variable de build.
- [x] [DT-ENV-02] **Cerrado**: sass-back no arrancaba (`Worker requires a connection`) porque se había perdido el
  `BullModule.forRoot`; restaurado en `AppModule` leyendo `REDIS_URL` (`src/redis/bull-connection.ts`).
  Sigue haciendo falta un Redis real para los webhooks: no se probó contra uno.
- [ ] [DT-ENV-03] storefront: `x-organization-id` del navegador sale de una variable fija; no sirve para varias
  tiendas en un mismo despliegue. Resolver la organización por slug (ya la entrega `customer.resolveStore`).
- [x] [DT-ENV-04] ecommerce-back: la imagen usa `PORT=3025` (ENV, EXPOSE y HEALTHCHECK), igual que local y `puertos.md`.
- [x] [DT-ENV-05] `.env.local.example` duplicados de dashboard y sass-front borrados (queda `.env.example`).

### Pendiente — P0

- [x] **[DT-TEST-01] Los tests de los backs no se pueden ejecutar** (verificado 2026-10-08): `pnpm test` falla porque cada back — **Cerrado 2026-10-14 (DT-Q-06)**: los tests corren.
  tiene `jest.config.js` **y** la clave `jest` en `package.json` ("Multiple configurations found"); con
  `--config jest.config.js` las 16 suites (8 por back) fallan sin correr un solo test por TS5011 (TypeScript 6 exige
  `rootDir` en ts-jest). Es previo a la sesión del ADR-019. Prerrequisito de S4-E (tests de backend).
- [ ] **[DT-DOCKER-01] `docker build` real** de los 3 fronts y de los 2 backs. Lo verificado hasta ahora son los
  comandos de cada stage y el arranque del runtime emulado, sin Docker. Railway valida la sintaxis (ya mostró un error).

### Pendiente — P1

- [x] [DT-CI-01] `ci-*-front.yml` corren `lint` y `build`; el lint de los fronts no se verificó. — **Cerrado**: lint de los 4 fronts en 0 (ADR-022).
- [x] [DT-CI-02] Hay 15 workflows con jobs duplicados (`ci-*` y `realsass-*`/`trpc-contract`): unificar en los 7 documentados. — **Cerrado**: `ci.yml` + `secrets.yml` (WEL-05).
- [ ] [DT-SF-01] `sass-front`: `UserProfile.isOwner` no existe en el contrato; "dueño" se deriva de
  `profile.organization !== null`. Confirmar la regla.
- [ ] [DT-DASH-01] ecommerce-back: procedure para editar variantes (SKU/precio) y para cambiar el estado de un
  pedido; el dashboard no puede hacerlo hoy.
- [ ] [DT-DASH-02] `features/chat`: unificar `hooks.ts`/`hooks/` y `types.ts`/`types/` en un único shape de
  chat-ia-back; hoy conviven tres.
- [ ] [DT-DASH-03] Borrar `features/config-*/services/*.service.ts` (REST legacy sin uso) y migrar `campanas` /
  `pagos` fuera de `lib/api-client.ts` cuando esos servicios tengan router tRPC.
- [ ] [DT-DASH-04] Permisos finos por colaborador (ver `modules/dashboard-front/tienda.md`) sin cablear en las
  pantallas de Tienda.

### Deuda consciente

- `MarketDTO` duplicado en `packages/trpc/src/markets.ts` y la entidad de sass-back.
- Los tipos de fecha del contrato dicen `Date` pero viajan como string (cliente tRPC sin transformer).
- `src/generated/` (cliente Prisma) de ambos backs no está en `.gitignore`.
- Los `.d.ts` de contratos dejan `@nestjs/*`, `express` y `@prisma/client-runtime-utils` sin resolver en los fronts
  (resuelven a `any` solo fuera de la salida de los routers).

---

## Cerrado en sesión 2026-09-19 ✅

- [x] InternalModule con pause-store/resume-store en realsass-sass-back
- [x] Prisma schema limpio (OrgStatus + StoreStatus solo en Organization)
- [x] ecommerceEnabled: org.storeStatus === 'ACTIVE'
- [x] GET /organizations/public/by-slug/:slug expuesto

---

## Cerrado en sesión 2026-09-28 ✅ — Audit de tipado + Hardening

### Tipado (ADR-007)

- [x] **HARD-01** — `realsass-ecommerce-back/src/app.module.ts` — import duplicado corregido
- [x] **HARD-02** — `organizations-client.service.ts` — `}` de más antes de `resolveMarket()` corregido
- [x] **HARD-03** — `packages/trpc/src/index.ts` — paths relativos con profundidad incorrecta corregidos
- [x] **HARD-04** — `packages/trpc/src/index.ts` — exports `t`/`router` inexistentes corregidos a `createTRPCRouter`/`publicProcedure`/`protectedProcedure`
- [x] **HARD-05** — `orders.service.ts` — `market` resuelto vía `orgsClient.resolveMarket()` antes de la transacción
- [x] **HARD-06** — `customer.router.ts` — firma de `checkout()` corregida a objeto único con `organizationId`
- [x] **HARD-07** — `orders.service.ts` — `sessionId` eliminado de `order.create` (columna no existe en schema)
- [x] **HARD-08** — `use-toast.ts` en 3 fronts — `ToastProps`/`ToastActionElement` definidos localmente
- [x] **HARD-09** — `use-market-store.ts` — `createJSONStorage` + movido a `stores/` (plural)
- [x] `packages/auth-client` — `tsconfig.json` con `skipLibCheck: true` + `firebase.ts` usa `env()` helper con `globalThis`
- [x] `packages/trpc/src/server/trpc.ts` — `superjson` transformer agregado
- [x] Spec files — comentarios `// @real/jsonb-cast` en medio de expresiones reemplazados por `/* */`
- [x] 30+ `as any` y `as unknown as` reemplazados por tipos reales del ecosistema
- [x] `PrismaTransactionClient` — tipo propio exportado desde `prisma.service.ts` que refleja la realidad del adaptador PG — elimina 3 casteos en `orders.service.ts`
- [x] `InventoryService.reserveWithinTransaction` — migrado a `PrismaTransactionClient`
- [x] `instanceof ZodError` en ambos `trpc.ts` — elimina doble cast `as unknown as ZodError`
- [x] `jest.spyOn(globalThis, 'fetch')` en `store.service.spec.ts` — elimina `global.fetch = fn as unknown as typeof fetch`
- [x] `orders.service.spec.ts` — reescrito con `Test.createTestingModule` con los 5 providers correctos
- [x] `catalog.service.spec.ts` — `validDto` tipado como `CreateProductDto`, `UpdateProductPatch` directo
- [x] `markets.integration.spec.ts` — mock tipado como `jest.Mocked<MarketsService>` sin cast
- [x] `ApiEnvelope.data` — marcado opcional (`data?: T`) eliminando cast en `api-fetch.ts`
- [x] `json-ld.spec.ts` — `as any` → `as JsonLdObject` (tipo ya exportado en `json-ld.ts`)

### Audit B — estado post sesión 2026-09-28

```
B1  as any sin @real/         → ✅ 0 hallazgos reales
B1b : any en parámetros       → ✅ 0 hallazgos reales
B2  as unknown as sin @real/  → ✅ 0 hallazgos reales
B3  @ts-ignore                → ✅ 0
B4  @ts-expect-error          → ✅ 0
B5  class-validator           → ✅ 0
B6  strict: true              → ✅ activo

D1  as any @real/browser-compat → ⚠ 1 (firebase.ts — inevitable sin @types/node en package browser)
D2  as unknown as @real/        → ✅ 0
D3  @real/jsonb-cast repository → ✅ 0
D4  @real/jsonb-cast fuera repo → ✅ 0
```

---

## Pendiente activo — P0 para producción

### [WEL-01] Migración Prisma — BLOQUEANTE
```bash
cd realsass-sass-back
pnpm prisma migrate dev --name add-superadmin-org-fields
cd ../realsass-ecommerce-back
pnpm prisma migrate dev --name add_market_fields_to_order
```
Sin esta migración, el deploy en Railway falla al arrancar.

### [WEL-02] INTERNAL_API_KEY en Railway
Variable de entorno en realsass-sass-back.
Sin esto, grupojl-control recibe 403 en /internal/organizations.

### [WEL-03] pnpm prisma generate en ambos backs
```bash
cd realsass-ecommerce-back && pnpm prisma generate && cd ..
cd realsass-sass-back && pnpm prisma generate && cd ..
```
Sin esto, `pnpm typecheck` falla en los repositories por Prisma Client no generado.

---

## Pendiente activo — P1

### [WEL-04] HydrationBoundary en dashboard-front
- realsass-dashboard-front/app/dashboard/tienda/productos/page.tsx
- realsass-dashboard-front/app/dashboard/tienda/pedidos/page.tsx
Patrón documentado en .claude/decisions/ADR-009.

### [WEL-05] GitHub Actions ✅ resuelto 2026-10-14
Reemplazados por un único `ci.yml` + `secrets.yml` (ver ADR-022). Pendiente: branch protection (WEL-06 / DT-Q-07).

### [WEL-06] Branch protection en GitHub
### [WEL-07] OTEL_EXPORTER_OTLP_ENDPOINT en Railway

---

## Deuda conocida — no urgente

- `checkout.controller.ts` — paymentIntentId en null hasta pagos-back
- Storefront pages /tienda/[slug]/ con JSX inline — pendiente design system
- `firebase.ts` — `(globalThis as any /* @real/browser-compat */).process` — inevitable sin @types/node en package browser. Fix alternativo: eliminar auto-init y obligar a los fronts a llamar `initFirebase(config)` explícitamente desde Next.js — puntuado 9/10.

---

## Sprint Markets — ADR-014 ✅ COMPLETADO 2026-09-21

- [x] sass-back: MKT-01..09 — modelo Market + resolveMarket() + tRPC router
- [x] ecommerce-back: MKT-E-01..06 — resolveMarket consumer + Order fields
- [x] ecommerce-front: MKT-F-01..05 — useMarketStore + MarketBanner + detector
- [x] @real/trpc: MarketDTO + FulfillmentConfig exportados
- [x] Wiring: MarketsModule en AppModule + TrpcModule, marketsService en handler
- [x] Internal: GET /internal/organizations/:id/markets para superadmin

### Pendiente siguiente sprint
- [ ] MKT-D-01..04: UI gestión Markets en dashboard-front
- [ ] Migraciones Prisma en sass-back + ecommerce-back (requiere DB) — ver WEL-01

---

## Observabilidad ✅ COMPLETADA 2026-09-21

- [x] OBS-W-01..09 — LoggerModule, PrometheusModule, CorrelationId, Health checks, CI

---

## SEO + idioma (ADR-016) — detectado 2026-09-22

### Bloqueantes (prerequisito del SEO)
- [ ] DT-SEO-01: sass-back `createForUserWithDefaultMarket` fuera de la clase
- [ ] DT-SEO-02: `findBySlug` sin `storeStatus` en el select → toda tienda en 404
- [ ] DT-SEO-03: storefront invoca procedures tRPC sin `.query()` → `resolveStore` siempre falla
- [ ] DT-SEO-04: páginas del storefront contra shape inexistente (`p.slug`, `p.priceCents`, `p.imageUrls`)
- [ ] DT-SEO-05: `catch {}` → `null` en data fetching → caída de backend = 404 masivo
- [ ] DT-SEO-06: `lib/store/index.ts` re-exporta `./types` inexistente

### Deuda consciente
- [ ] DT-SEO-07: quitar `ignoreBuildErrors: true` de `real-ecommerce-front/next.config.mjs`
- [ ] DT-SEO-08: `images.unoptimized: true` → LCP alto
- [ ] DT-SEO-09: modelo `Product` sin imágenes → rich results incompletos
- [ ] DT-SEO-10: ruta legacy `/categoria/[categoria]` con 307 en vez de 308
- [ ] DT-SEO-11: organizaciones sin Market default → `resolveMarket` lanza NOT_FOUND
- [ ] DT-SEO-12: repomix no incluye `middleware.ts`, `lib/**/*.tsx`, `store/**`
