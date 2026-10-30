# Deuda técnica — welver

Última actualización: 2026-10-30


## ⏸ Diferido a propósito (decisión del 2026-10-16: se deja marcado, no se toca ahora)

- [ ] **Docker (DT-DOCKER-01)**: ningún `docker build` real de los 3 fronts ni de los 2 backs. Hallazgos al revisar los Dockerfile, sin corregir:
  - el `HEALTHCHECK` del **ecommerce-back** apunta a `http://localhost:3001/health`, pero la ruta real es `/api/v1/health` (hoy da 404) y el puerto está fijo;
  - el `HEALTHCHECK` del **sass-back** usa el puerto 3000 y la app corre en 3020;
  - **DT-ENV-04**: la imagen del ecommerce-back fija `PORT=3001` y local es `3025`.
- [ ] **Despliegue en Railway (WEL-01 a WEL-03)**: migraciones de Prisma (el doc marca la migración como **bloqueante**), `INTERNAL_API_KEY` en ambos servicios y `prisma generate`. Nota: la migración `user_sessions` (ADR-020) ya se aplicó en la base de Railway; las demás siguen pendientes.
- [ ] **Pago en línea**: no existe (depende de `pagos-back`). El checkout crea el pedido en `PENDING_PAYMENT` y el texto le avisa al cliente que la tienda coordina el cobro.

## Cierre de deuda — 2026-10-16

Resuelto en esta tanda (todo con tests; sass-back 18/18 suites, ecommerce-back 13/13, storefront 114 tests):

- **Los tests de los backs corren** (DT-TEST-01, DT-ENT-01): una sola config de Jest por back (había dos que se pisaban), `tsconfig.spec.json` (TS5011), alias del `tsconfig` también en Jest, stub de `jose` (ESM), `typeRoots` corregido. Se borraron 8 specs que no probaban nada (plantillas de "should be defined" y controladores que ya no existen); `organization-access.spec` se reescribió contra la implementación actual; las demás specs rotas se arreglaron.
- **Seguridad de Markets (nuevo, alta)**: todas las operaciones de `markets.*` eran `publicProcedure`; cualquiera, sin sesión, podía crear, cambiar o borrar mercados de cualquier tienda (el `organizationId` es público). Ahora: `list` miembro, `create/update/setDefault/delete` solo el dueño y solo sobre su organización (otra → FORBIDDEN/NOT_FOUND), `resolve` solo servicio-a-servicio con `INTERNAL_API_KEY` (fail-closed, comparación en tiempo constante).
- **Carrito con dueño** (DT-STORE-SEC-2): el carrito guarda su `customerId`; `get/addItem/removeItem/checkout` solo funcionan para su dueño (404 para otro) y `addItem` ya no acepta cualquier `cartId`.
- **Organización validada** (DT-STORE-SEC-3): `GET /organizations/public/by-id/:id` en el sass-back; el ecommerce-back no crea clientes en organizaciones inexistentes o sin ecommerce (caché 60 s; una caída del sass-back da 503, no "no existe").
- **Stock** (DT-STORE-INV): un solo modelo, `available` = vendible y `reserved` = retenido; el SQL del checkout ya no resta lo reservado dos veces y el front tampoco.
- **Sesión cerrada también en el ecommerce-back** (DT-SES-05): `GET /internal/sessions/:sid/revoked` (servicio-a-servicio) + chequeo con caché de 30 s y fail-open.
- **Entorno**: `.env.local.example` duplicados borrados (DT-ENV-05); el dashboard usa `SASS_BACK_URL` primero (DT-ENV-01); el storefront toma la organización de la tienda que se está viendo (DT-ENV-03, rutas `/tienda/{slug}`).
- **Entradas viejas verificadas en el código y cerradas**: DT-SEO-01 a 07.

## URLs limpias — ADR-022 (2026-10-16)

- [x] Panel en la raíz (`/dashboard/**` → `/**`, 308) y tiendas en `/{locale}/{slug}` (`/{locale}/tienda/{slug}` → 308; `/{slug}` y `/tienda/{slug}` sin idioma → 307 al idioma negociado).
- [ ] DT-URL-1: reservar los nombres de rutas fijas del storefront (`checkout`, `tracking`, `sitemaps`…) como slugs inválidos si algún día se permiten slugs a medida; hoy los slugs llevan sufijo numérico.
- [ ] DT-URL-2: evaluar subdominio por tienda (`{slug}.dominio.com`) como evolución; exige DNS comodín y resolver la tienda por host.

## Desktop — Tauri, opción A (ADR-023, 2026-10-16) — planificado, nada implementado

- [x] DT-DESK-0: F0 **escrito** (`realsass-dashboard-desktop/`: ventana a `DASHBOARD_URL`, capabilities mínimas, CSP, íconos provisorios, navegación restringida).
- [ ] DT-DESK-0b: **compilar y probar F0 + F1 en una máquina con Rust** (checklist en `realsass-dashboard-desktop/README.md`). Sigue sin hacerse: esta máquina no tiene Rust ni las Build Tools de C++. Ahora también cubre el login con PKCE (DT-DESK-3). Alternativa sin Rust local: correr `ci-desktop.yml` / `desktop-release.yml` en GitHub (nunca se ejecutaron).
- [x] DT-DESK-1: F1 **escrito**: login por el navegador del sistema + loopback + página puente `/desktop-login` + botón en `/login` (la parte web compila; la parte Rust no se compiló).
- [x] DT-DESK-2: F2 **escrito**: instancia única, estado de ventana, deep link `welver://open?path=…` y auto-actualización firmada (feature `updater`, con confirmación). Sin compilar.
- [ ] DT-DESK-2b: activar el updater: generar claves (`cargo tauri signer generate`), pegar la clave pública en `tauri.updater.conf.json` y cargar `TAURI_SIGNING_PRIVATE_KEY` en los secretos del repo.
- [x] DT-DESK-8: pipeline de release escrito (`.github/workflows/desktop-release.yml`); **sin ejecutar**. Permite probar el instalador sin Rust local.
- [x] DT-DESK-3 (2026-10-20): login endurecido con **PKCE + código de un solo uso**: por el loopback ya no viaja un token sino un código (60 s, un uso, Redis con GETDEL) y el `verifier` no sale de la app. **Verificado:** back (`auth.issueDesktopLoginCode` / `redeemDesktopLogin`, 7 tests incl. "código robado sin verifier no sirve"), web (`/desktop-login`, `/auth/desktop`, `lib/desktop.ts`) y typecheck de los tres repos. **No verificado:** el cambio en Rust (`main.rs`: CSPRNG con `getrandom`, SHA-256, vigencia de 5 min; tests escritos) — se compila con DT-DESK-0b.
- [ ] DT-DESK-4: **mitad hecha.** Escrito, sin ejecutar: `deny.toml`, `cargo audit` + `cargo deny` + `clippy` en `ci-desktop.yml` y en `desktop-release.yml` (la primera corrida puede pedir ajustar licencias). **Sigue abierto:** firma de código (Authenticode / notarización de Apple), que **requiere certificados comprados**.
- [x] DT-DESK-9: notificaciones nativas — **decidido no implementar todavía** (sin IPC remoto y sin productor de notificaciones en el panel).
- [ ] DT-DESK-5: decidir si hace falta funcionar sin conexión (reabriría la opción B: bundle estático).
- [x] DT-DESK-11 (2026-10-20): **versión mínima soportada y "rollback" por bloqueo.** El updater de Tauri solo sube de versión, así que el rollback real es avanzar a una corregida: `DESKTOP_MIN_VERSION` y `DESKTOP_BLOCKED_VERSIONS` (sass-back, `desktop.policy`) hacen que el panel dentro de la app (`DesktopGuard`) pida actualizar a quien tenga una versión baja o rota. Verificado: 5 tests de back, 9 de la lógica de versiones en web, typecheck. Runbook en el README del desktop. Límite: lo aplica el panel, no el Rust.
- [ ] DT-DESK-12: **parcial.** Hecho: tests del protocolo en back (canje, código robado sin verifier, un solo uso, vencimiento) y en web, y un vector SHA-256 compartido con los tests de Rust para detectar desfases entre lenguajes. **Falta** el e2e real (app compilada → navegador → loopback → panel, y deep link): necesita el Rust compilado (DT-DESK-0b) y un runner de UI.
- [ ] DT-DESK-13: **mitad hecha.** Hecho (verificado con tests): consentimiento al primer arranque, ping de versión + sistema operativo y errores del panel, solo si se aceptó (`desktop.telemetry`, contadores por versión/día en Redis, con límite por IP y sin datos personales). **Falta:** crashes nativos del Rust (panics) y un lugar donde ver las métricas (hoy son contadores en Redis y líneas de log).
- [x] DT-DESK-6 (2026-10-20): la parte web del login de escritorio tiene tests: vitest en `realsass-dashboard-front` (`pnpm test`, 10 tests de `lib/desktop.ts`: puerto, state, challenge/verifier/código, URLs de loopback, redirect abierto, puente). Corre en `ci-desktop.yml`.
- [x] DT-DESK-7: ícono generado desde el logo del dashboard (PNG/ICO/ICNS).
- [ ] DT-DESK-10: **el logo del dashboard es el logo de Apple** (marca registrada): no distribuir públicamente; reemplazar por el logo propio y regenerar con `cargo tauri icon`.

## WhatsApp por organización — ADR-025 (2026-10-20) — planificado, nada implementado

- [x] DT-WA-01: sección "WhatsApp" en `realsass-sass-front` (`/profile/config`), **armada el 2026-10-20**: SDK + Embedded Signup, step-up, estados de vista, tipos inferidos del contrato. Typecheck en verde; **sin probar en navegador ni contra Meta**.
- [x] DT-WA-02: canal elegido = **B** (tRPC `whatsapp.*` en sass-back → HTTP interno a chatia). Implementado: `realsass-sass-back/src/whatsapp/`, `trpc/routers/whatsapp.router.ts` (+6 tests), `CHATIA_BACK_URL`.
- [x] DT-WA-05: chatia (ecosistema-ms): endpoints internos, desconexión, estado de la organización, webhook único de plataforma (`/webhooks/whatsapp`) y rechazo de cuentas inactivas. 621 tests en verde. **Sin commitear en ese repo.**
- [ ] DT-WA-06: **crear/configurar la app de Meta** (Tech Provider, App Review, `config_id`, webhook, dominios del SDK) y cargar las variables: `checklists/meta-whatsapp-app.md`. Lo hace una persona con acceso al negocio; bloquea la prueba real.
- [ ] DT-WA-07: prueba de punta a punta con un número real (checklist, paso 5), e2e automático del flujo y tests del router `whatsapp` y de la sección del front (el front no tiene runner).
- [ ] DT-WA-03: migrar `lib/chat-ia-client.ts` (fetch manual del dashboard) a tRPC; ya no depende de esta feature.
- [ ] DT-WA-04: decisiones de producto abiertas: ¿varios números por organización?, plan ante suspensión de la app compartida, normalización de más países y plantillas de mensaje (ecosistema-ms).

## Robustez multi-tenant e idempotencia — ADR-029 (2026-10-30)

- [x] DT-IDEM-1: checkout idempotente (bloqueo del carrito + reintento devuelve la orden existente). Tests de unidad en verde.
- [ ] DT-IDEM-2: prueba del checkout concurrente contra Postgres real (el mock no ejercita `FOR UPDATE`).
- [~] DT-TENANT-1: `prisma.forTenant()` **adoptado** en los repositorios del ecommerce-back (catálogo, carrito, inventario, clientes, órdenes) y `ActivityService`; el carrito, `orders.updateStatus/setPaymentIntent` y `customers.update` ya reciben `organizationId` (antes actualizaban solo por id). **Falta:** sass-back, y el SQL crudo / transacciones interactivas (checkout, `reserveWithinTransaction`), que filtran a mano.
- [ ] DT-IDEM-3: tabla `IdempotencyKey` + webhooks de pago deduplicados + `Idempotency-Key` en cobros (con `pagos-back`).
- [~] DT-EVT-1: Outbox implementado y **migración aplicada** (2026-10-30); escritura y relay apagados. Falta: activar `OUTBOX_ENABLED`/`OUTBOX_RELAY_ENABLED` y escribir un publisher real.
- [~] DT-TENANT-2: `prisma/rls/enable-rls.sql` + `runAsTenant` listos y **sin aplicar**. Falta: rol de aplicación no superusuario, todas las queries bajo `runAsTenant`, prueba en staging.
- [~] DT-OUTBOX-2: probados contra Postgres real (solo lectura): migración, `forTenant`, `set_config`, SQL del claim. **Falta:** relay con eventos reales, aislamiento entre ≥2 organizaciones con datos, y las políticas RLS en staging.

## Tests — estado y pendientes (2026-10-30)

Foto de `pnpm test` en cada workspace: **todo en verde, 0 fallos**. sass-back 30/30 suites (150 tests, 34 `todo`) · ecommerce-back 22 suites (198 tests, 8 saltados, 4 `todo`, 1 suite saltada) · storefront 156 · dashboard-front 19 · sass-front 16 · `@real/ui` 10 · `@real/auth-client` 28 · `@real/auth-server` 51 · `@real/i18n` 11 · `@real/trpc` sin tests. Todo corre con mocks. Pendiente para la próxima sesión:

- [ ] DT-TEST-03: **tests contra infraestructura real** (Postgres, Redis; Firebase con emulador). Hoy nada ejercita el `FOR UPDATE` del checkout, RLS ni el aislamiento entre ≥2 organizaciones con datos. Cubre DT-IDEM-2 y DT-OUTBOX-2.
- [ ] DT-TEST-04: **e2e (Playwright)** de login, sesión compartida entre fronts, checkout y cerrar sesión desde «Dispositivos». Incluye los tests de integración de sesión (DT-SES-06) y el smoke del storefront (DT-TEST-02).
- [ ] DT-TEST-05: **fronts poco cubiertos**: dashboard-front tiene 1 archivo de test y sass-front 2; faltan tests de render de sus páginas (con ambos providers, ver DT-DASH-CTX). `@real/ui` tiene 33 componentes y 1 archivo de test.
- [ ] DT-TEST-06: **medir la cobertura real** (el objetivo es 85% en paths críticos, S4-E) y fijar el umbral en CI; hoy no se mide.
- [ ] DT-TEST-07: **revisar los `todo` y los tests saltados** (34 en sass-back; 4 `todo`, 8 saltados y 1 suite saltada en ecommerce-back) por si esconden algo importante; cerrarlos o borrarlos.
- [ ] DT-TEST-08: **`@real/trpc` sin tests**: al menos un test de contrato que detecte un `dist` desfasado o un procedure con `any`.
- [ ] DT-TEST-09: **el CI nunca corrió**: ninguno de estos tests se verificó fuera de la máquina local (ver DT-CI-01 y DT-CI-02).
- [ ] DT-TEST-10: en la corrida del ecommerce-back apareció un stack trace de jest-circus en la salida; no se identificó qué test lo causa (el back terminó con 0 fallos, probablemente sea un error provocado a propósito). Revisarlo.

## Sigue abierto (sin decisión o sin tiempo, ver cada línea)

- **DT-SES-04** mail de dispositivo nuevo: necesita elegir un proveedor de mail (checklist R4 de ADR-018) y un dueño.
- **DT-SES-09** unificar el `AuthContext` de `sass-front` con el `AuthProvider` compartido: refactor grande de auth sin pruebas en navegador; no se hizo a ciegas.
- **DT-CI-02 / DT-CI-01** workflows duplicados y lint de los fronts: no se pueden probar sin GitHub Actions; se dejan para cuando se pueda correr el CI.

---

## Sesiones y dispositivos — ADR-020 (2026-10-16)

- [x] DT-SES-01: F1 registro + `sessions.list` + modal · F2 revocar por sesión / las demás
- [x] DT-SES-02: purga de `UserSession` vencidas (cada 24 h, dentro del sass-back)
- [x] DT-SES-03: modal en `realsass-sass-front` (`/profile`) y en dashboard-front
- [ ] DT-SES-04: F3 mail de dispositivo nuevo — necesita proveedor de mail (checklist R4 de ADR-018) y dueño
- [x] DT-SES-05: `realsass-ecommerce-back` no chequea `__sid`: una sesión cerrada sigue válida contra ese back
- [ ] DT-SES-06: tests de integración del flujo (`POST /auth/session` → `__sid` → revoke → 401); hoy hay unit tests
- [x] DT-SES-07: sesión compartida entre fronts — `@real/auth-client` (AuthProvider) y `sass-front/context/auth-context.tsx` autentican por cookie si no hay usuario de Firebase en el origen
- [x] DT-SES-10: sesión en vivo entre fronts (`auth.ping` + `useSessionWatch`); límite: entre orígenes distintos se ve al volver a la pestaña o en ≤30 s
- [ ] DT-SES-11: cada pestaña visible hace un `auth.ping` cada 30 s al sass-back; si la carga molesta, subir el intervalo o pasar a SSE
- [x] DT-DASH-CTX: dashboard-front — las consultas `trpc.*` (sass-back) iban al ecommerce-back por compartir `TRPCContext`; `ecommerceTrpc` ahora tiene contexto propio. Faltan tests que lo detecten (render con ambos providers)
- [x] DT-AUTH-PERF: arranque lento de `/profile` — perfil por cookie primero, sync en segundo plano, prefetch SSR con la queryKey correcta, skeleton en vez de usuario por defecto
- [ ] DT-AUTH-PERF-2: el prefetch SSR solo existe en `/profile`; replicarlo en las demás páginas autenticadas, y evaluar `auth.sync` solo cuando haga falta (hoy corre en cada carga)
- [x] DT-AUTH-F5: muchos F5 en `/profile` agotaban el límite de `POST /auth/session` (10/min) y dejaban `sessionReady=false`; cookie recreada como máximo cada 30 min, tolerancia a 429, botón Dashboard espera la sesión, avatar con `referrerPolicy=no-referrer` (Google devuelve 429 al hotlink con Referer)
- [ ] DT-AUTH-F5-2: `auth.sync` y `/auth/session` siguen siendo las únicas llamadas con límite; evaluar subir el límite `auth` en dev o exentar el refresh con sesión válida
- [x] DT-STORE-429: el storefront dejaba de cargar tras ~10 vistas/min: `GET /organizations/public/by-slug/:slug` (sass-back) caía en el limitador `auth` (10/min, pensado para login) y en el global (30/min), y todo el tráfico del storefront sale de una IP. Ahora esa ruta salta el limitador `auth` y permite 600/min; `StoreService.resolveBySlug` (ecommerce-back) cachea 60 s, comparte consultas simultáneas y ante una falla del sass-back sirve la última copia buena hasta 10 min (un 404 nunca se tapa)
- [ ] DT-STORE-1: el `ThrottlerGuard` global aplica TODOS los limitadores con nombre a cada ruta REST; revisar el resto de rutas back-to-back (`/internal/*`, `/health`) por el mismo problema
- [x] DT-STORE-2: carrito en la UI del storefront (la bolsa vive en el avatar del navbar). Lo que sigue pendiente es el **pago en línea** → ver "Diferido a propósito".
- [x] DT-STORE-UI: diseño de la tienda por organización alineado con la home base (cabecera, hero por producto, pie con enlaces reales)
- [ ] DT-STORE-UI-2: probar las secciones hero con productos reales (la tienda de prueba tiene 0); los productos no tienen imágenes
- [ ] DT-STORE-UI-3: la home genérica `(site)` y `ShoppingBagModal` siguen con textos en inglés y datos de ejemplo; `Header` renderiza el modal sin respetar `isOpen`
- [x] DT-STORE-COMMERCE: cuenta del cliente, bolsa, agregar al carrito, checkout y pedidos en el storefront
- [x] DT-STORE-BUG-IDENTIFY: `customer.identify` devolvía el PRIMER invitado de la organización a cualquier visitante (todos compartían carrito y pedidos) y el router pasaba los argumentos desplazados; ahora es un cliente por (organización, email)
- [x] DT-STORE-BUG-ORDERS: `customer.orders` buscaba `cartId: ''` y devolvía siempre []; ahora `findByCustomer`
- [x] DT-STORE-BUG-CORS: el preflight rechazaba `x-customer-id`; `subtotalCents` incluía el envío
- [x] DT-STORE-SEC-1: identidad del cliente verificada con Firebase (ADR-021); `customer.identify` y el header `x-customer-id` eliminados
- [x] DT-STORE-SEC-3: el `x-organization-id` de un cliente no se valida contra el sass-back (un UUID inexistente crea un cliente huérfano); falta validar organización/ecosistema
- [ ] DT-STORE-AUTH-1: solo Google; Apple/Facebook requieren configurar proveedores. Sin SSO entre fronts (cada origen guarda su token)
- [x] DT-STORE-SEC-2: `cart.get`/`checkout` no comprueban que el carrito sea del cliente (basta el UUID del carrito); `addItem` no guarda el `customerId` en el carrito
- [x] DT-STORE-INV: `reserveWithinTransaction` resta de `quantity_available` Y suma a `quantity_reserved`, mientras la disponibilidad se calcula como available − reserved: el stock se descuenta dos veces
- [ ] DT-STORE-ERR: el ecommerce-back no traduce las excepciones de Nest a códigos tRPC (todo es INTERNAL_SERVER_ERROR); el front reconoce "no encontrado" por el texto
- [x] DT-STORE-TEST: fallan 2 specs previas del ecommerce-back (`orders.service.spec` espera COMPLETED y el código usa CONVERTED; `markets-checkout.integration.spec` importa una ruta inexistente); `unitPriceCentsSnapshot` del carrito queda en 0
- [ ] DT-STORE-UI-4: la UI de cuenta/bolsa/checkout nunca se abrió en un navegador (verificada por tipos, tests y el flujo contra el back); falta una pasada manual y la aserción de precio en la página de producto falló sin investigar
- [ ] DT-SES-08: en sesión solo-cookie no hay refresh a los 55 min (vence a los 14 días, sin tope de 90 de inactividad); el step-up abre Google (popup) e inicia sesión en ese origen; la organización activa no se comparte entre fronts (dashboard: sessionStorage, sass-front: localStorage)
- [ ] DT-SES-09: `sass-front` tiene su propio `AuthContext` duplicando al `AuthProvider` de `@real/auth-client` — unificar
- [x] DT-ENT-01: `realsass-sass-back` jest.config.js + tsconfig desalineados (TS5011, `typeRoots` apunta a un
      `node_modules/@types` raíz inexistente): `pnpm test` y `@real/trpc build` fallan en una instalación limpia

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

- [x] [DT-ENV-01] dashboard: el back de sass se llama `NEXT_PUBLIC_REAL_BACK_URL` en layout/provider/constants y
  `NEXT_PUBLIC_SASS_BACK_URL` en `api-client`/`providers`. Hoy hay que definir ambas. Unificar en `SASS_BACK_URL`.
- [x] [DT-ENV-02] **Cerrado**: sass-back no arrancaba (`Worker requires a connection`) porque se había perdido el
  `BullModule.forRoot`; restaurado en `AppModule` leyendo `REDIS_URL` (`src/redis/bull-connection.ts`).
  Sigue haciendo falta un Redis real para los webhooks: no se probó contra uno.
- [x] [DT-ENV-03] storefront: `x-organization-id` del navegador sale de una variable fija; no sirve para varias
  tiendas en un mismo despliegue. Resolver la organización por slug (ya la entrega `customer.resolveStore`).
- [ ] [DT-ENV-04] ecommerce-back: la imagen usa `PORT=3001` y local `3005`; alinear.
- [x] [DT-ENV-05] `realsass-dashboard-front/.env.local.example` y `realsass-sass-front/.env.local.example` quedaron
  duplicados y desactualizados (mencionan servicios inexistentes y `/api/v1` en las URLs): borrarlos.

### Pendiente — P0

- [x] **[DT-TEST-01] Los tests de los backs no se pueden ejecutar** (verificado 2026-10-08): `pnpm test` falla porque cada back
  tiene `jest.config.js` **y** la clave `jest` en `package.json` ("Multiple configurations found"); con
  `--config jest.config.js` las 16 suites (8 por back) fallan sin correr un solo test por TS5011 (TypeScript 6 exige
  `rootDir` en ts-jest). Es previo a la sesión del ADR-019. Prerrequisito de S4-E (tests de backend).
- [ ] **[DT-DOCKER-01] `docker build` real** de los 3 fronts y de los 2 backs. Lo verificado hasta ahora son los
  comandos de cada stage y el arranque del runtime emulado, sin Docker. Railway valida la sintaxis (ya mostró un error).

### Pendiente — P1

- [ ] [DT-CI-01] `ci-*-front.yml` corren `lint` y `build`; el lint de los fronts no se verificó.
- [ ] [DT-CI-02] Hay 15 workflows con jobs duplicados (`ci-*` y `realsass-*`/`trpc-contract`): unificar en los 7 documentados.
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

### [WEL-05] GitHub Actions — 7 workflows
Documentados en .claude/decisions/ADR-013.
Trigger: antes de onboardear al primer colaborador externo.

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
- [x] DT-SEO-01: sass-back `createForUserWithDefaultMarket` fuera de la clase
- [x] DT-SEO-02: `findBySlug` sin `storeStatus` en el select → toda tienda en 404
- [x] DT-SEO-03: storefront invoca procedures tRPC sin `.query()` → `resolveStore` siempre falla
- [x] DT-SEO-04: páginas del storefront contra shape inexistente (`p.slug`, `p.priceCents`, `p.imageUrls`)
- [x] DT-SEO-05: `catch {}` → `null` en data fetching → caída de backend = 404 masivo
- [x] DT-SEO-06: `lib/store/index.ts` re-exporta `./types` inexistente

### Deuda consciente
- [x] DT-SEO-07: quitar `ignoreBuildErrors: true` de `real-ecommerce-front/next.config.mjs`
- [ ] DT-SEO-08: `images.unoptimized: true` → LCP alto
- [ ] DT-SEO-09: modelo `Product` sin imágenes → rich results incompletos
- [ ] DT-SEO-10: ruta legacy `/categoria/[categoria]` con 307 en vez de 308
- [ ] DT-SEO-11: organizaciones sin Market default → `resolveMarket` lanza NOT_FOUND
- [ ] DT-SEO-12: repomix no incluye `middleware.ts`, `lib/**/*.tsx`, `store/**`

## SEO de los 3 fronts — 2026-10-16

Auditoría medida contra `architecture/10-seo-i18n-norte.md` y corregida (tsc limpio, vitest 125, ecommerce-back 13/13 suites, verificado en vivo):

- [x] Storefront: `robots.txt` anunciaba `/sitemaps` que daba 404 → índice de sitemaps (`customer.listStores` ← `GET /organizations/public/stores`, caché 10 min, 503 ante caída; nunca índice vacío).
- [x] Storefront: 404 de tienda traducido (5 idiomas), descripciones propias en `/productos` y categorías, un solo `<h1>` por página, imagen Open Graph generada (`opengraph-image.tsx`) y Twitter `summary_large_image`.
- [x] Dashboard: `noindex` global + `robots.txt` `Disallow: /`; título "Stock Apple" (resto de otro proyecto) corregido.
- [x] sass-front: privado por defecto (`noindex`); solo la landing es indexable (canonical, OG, Twitter), `robots.txt` y `sitemap.xml`.
- [ ] DT-SEO-11: la landing de sass-front **sigue siendo la plantilla inmobiliaria "Propiedad"** (texto en inglés, `lang="en"`). Los metadatos coinciden con lo que muestra; falta decidir/escribir el contenido real de Welver y recién ahí ajustar título, descripción e idioma.
- [ ] DT-SEO-12: definir `NEXT_PUBLIC_SITE_URL` en sass-front en producción (sin ella el canonical es relativo y el sitemap queda vacío).
- [ ] DT-SEO-09 (ya existente): imágenes de producto; el JSON-LD y OG de producto no tienen foto hasta entonces.

## UI/UX adaptable — 2026-10-17 (ADR-024)

Norte definido en `architecture/12-ui-norte.md`. **Aún no se auditó ningún front contra él**: lo siguiente son deudas conocidas o por verificar.

- [ ] DT-UI-01: mapear las clases 600/840 al tema de Tailwind y exponerlas desde `@real/ui` (hoy cada front usa los cortes por defecto 640/768/1024).
- [ ] DT-UI-02: `realsass-sass-front` tiene `viewport` con `maximumScale: 1` y `userScalable: false` (bloquea el zoom). Revisar también los otros dos fronts.
- [ ] DT-UI-03: **auditar los 3 fronts** contra los 6 pilares (storefront primero): navegación por tamaño, objetivos táctiles ≥44 px, dependencia de hover, estados cargando/vacío/error/sin permisos, valores hardcodeados.
- [ ] DT-UI-04: Core Web Vitals del storefront: medir LCP/INP/CLS (hoy sin medición) y fijar umbral en CI.
- [ ] DT-UI-05: accesibilidad: pasar axe/Lighthouse sobre las pantallas principales (contraste AA, foco, `prefers-reduced-motion`).
