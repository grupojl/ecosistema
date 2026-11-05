# Deuda técnica — welver

Última actualización: 2026-11-05

## Región de datos — ADR-031 (2026-11-05)

- [x] `Organization.dataRegion` + `regionDe(countryCode)` + migración `20261105120000_organization_data_region` (código y tests de `regionDe` en verde).
- [ ] DT-REG-1: **aplicar la migración** en cada entorno (`prisma migrate deploy`).
- [ ] DT-REG-2: tabla de políticas por país (retención, consentimiento, borrado, transferencia internacional), con el primer consumidor (retención de Welver). Sin valores legales inventados.
- [ ] DT-REG-3: validación legal por un abogado local (Ley 25.326 con datos en EE.UU.) antes de firmar con un municipio.
- [ ] DT-REG-4: sumar `dataRegion` (aditivo) a `OrganizationAccess` / `GET /internal/access/...` cuando otro back lo necesite.
- [ ] DT-REG-6: `ar` es solo una etiqueta; no hay infraestructura en Argentina. No prometer residencia física en el país en contratos ni material comercial hasta que exista un despliegue real.
- [ ] DT-REG-5: ADR de infraestructura (hosting, CI y backups) y, si un cliente exige residencia física, ADR de región por organización.

## ✅ Antes diferido, resuelto el 2026-11-03 (confirmado por el dueño del proyecto)

- [x] **Docker (DT-DOCKER-01)**: el build con Docker y el despliegue en Railway funcionan. Los hallazgos de healthcheck y puertos (ecommerce-back `/api/v1/health` y `3001` vs `3025`; sass-back `3000` vs `3020`; DT-ENV-04) quedaron superados por el despliegue. Si se tocó algún `HEALTHCHECK`, anotar cuál.
- [x] **Despliegue en Railway (WEL-01 a WEL-03)**: el despliegue corre. Detalle de migraciones, `INTERNAL_API_KEY` y `prisma generate` sin desglosar; la migración `user_sessions` (ADR-020) ya estaba aplicada.
- [x] **Pago en línea / microservicios**: el cobro funciona con `pasarelapagos-backend` (ecosistema-ms). Ya no aplica "la tienda coordina el cobro" salvo para pedidos sin pasarela.
- [~] **DT-IDEM-3**: hecha toda la parte de este repo (webhooks salientes + base de pagos entrantes en el ecommerce-back, 2026-11-03). Falta **conectar** `PaymentConfirmationService` y un `Idempotency-Key` de cobro a `pagos-back` (ecosistema-ms), que hoy no existe.

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
- [ ] DT-WA-07: prueba de punta a punta con un número real de Meta. Hecho: la sección del front (8 tests de render), el router `whatsapp` (contrato de acceso) y la lógica del Embedded Signup (10 tests, incluida la validación de origen de los mensajes).
- [ ] DT-WA-03: migrar `lib/chat-ia-client.ts` (fetch manual del dashboard) a tRPC; ya no depende de esta feature.
- [ ] DT-WA-04: decisiones de producto abiertas: ¿varios números por organización?, plan ante suspensión de la app compartida, normalización de más países y plantillas de mensaje (ecosistema-ms).

## Configuración general y del storefront — 2026-11-04

Módulo `settings` (sass-back `src/org-settings/`, tabla `organization_settings`, migración `20261104130000`): dos documentos JSON por organización, validados SIEMPRE con Zod (`org-settings.schema.ts`; todo campo tiene valor por defecto, `{}` es válido).

- **General** (cómo opera la organización/municipio): zona horaria, idioma por defecto, correo público y teléfono de emergencia, horario de atención (24/7 o grilla semanal + nota) y el **asistente de chat** (activado, nombre, bienvenida, mensaje fuera de horario, mensaje de «no sé» que deriva a una persona, aviso de asistente automático, «responder solo con el contenido cargado», correo de derivación).
- **Storefront** (lo público): nombre y lema públicos, SEO (título/descripción con tope de longitud), redes sociales, enlaces legales, aviso destacado, qué contacto se muestra, y **chat web** (activado, posición, saludo, dominios autorizados a incrustarlo: solo orígenes https o localhost, sin ruta).
- tRPC `settings.get` (miembros; devuelve `canEdit` calculado en el servidor), `updateGeneral` / `updateStorefront` (solo dueño, con auditoría de qué secciones cambiaron), `getPublicStorefront` (público por slug: respeta `display`, nunca expone dominios autorizados ni mensajes internos del asistente) y `OrgSettingsService.isChatOriginAllowed` para el chat web.
- UI: formularios compartidos en `@real/ui` (`GeneralSettingsForm`, `StorefrontSettingsForm`, 10 tests); dashboard `/configuracion/general` y `/configuracion/tienda`; sass-front sección «Configuración general» en `/profile/config` (pestañas General/Storefront). Colaborador: solo lectura.
- Aislamiento: `OrganizationSettings` está en `TENANT_MODELS` (forTenant), en los scripts RLS y en la suite de 2 organizaciones. Contrato de acceso congelado en `access-matrix.spec.ts`.
- [ ] **DT-SET-1: aplicar la migración `20261104130000_organization_settings`** donde corra el back (Railway). Hasta entonces `settings.get` falla con «relation does not exist».
- [ ] DT-SET-2: **el storefront todavía no consume `getPublicStorefront`**: falta mostrar el aviso destacado, redes, enlaces legales y SEO/título públicos en `real-ecommerce-front`.
- [ ] DT-SET-3: el **asistente y el chat web aún no leen esta configuración** (viven en ecosistema-ms/chatia): hay que pasarles horario, mensajes, `answerOnlyFromContent` y validar el origen con `isChatOriginAllowed`. Hoy es solo configuración guardada.
- [ ] DT-SET-4: textos de los formularios fijos en español (parte de la deuda de idioma de `@real/ui`); sin prueba en navegador.
- [ ] DT-SET-5: lo que sigue del contexto municipio, sin construir: organigrama (unidades con jerarquía y permisos por unidad), contenido por entidad con estados/aprobación, derivación a la unidad correcta y varios números de WhatsApp por organización (DT-WA-04).

## Robustez multi-tenant e idempotencia — ADR-029 (2026-10-30)

- [x] DT-IDEM-1: checkout idempotente (bloqueo del carrito + reintento devuelve la orden existente). Tests de unidad en verde.
- [x] DT-IDEM-2: **hecho (2026-11-03)** — `checkout.concurrency.integration.spec.ts` contra Postgres real: 5 checkouts simultáneos del mismo carrito → UNA orden y stock reservado una vez; dos compradores por la última unidad → uno gana, sin sobreventa; el perdedor no deja reserva ni orden. Verificado que falla si se quita el `FOR UPDATE`.
- [~] DT-TENANT-1: `prisma.forTenant()` **adoptado** en el ecommerce-back y, desde 2026-11-04, en **sass-back** (`src/prisma/tenant-scope.ts`): colaboradores (repositorio y servicio, incluida la aceptación de invitación, que toma la organización de la invitación), claves, cuotas, webhooks, markets, temas, plantillas y reportes de usuario (`feedback`, lo de la organización). Los métodos por id (`collaborators.update/remove`, `markets.update/delete`, `themes.remove`) reciben la organización: con otra organización fallan y la fila ajena no se toca (probado en Postgres real). La entrega de webhooks (`dispatch`) busca solo los de la organización. El checkout del ecommerce-back corre bajo `runAsTenant`. **Quedan sin acotar a propósito:** `FeatureFlag` y `ConfigAuditLog` (filas globales con `organizationId` null mezcladas con las de cada organización: necesitan un diseño «org o global», `NULLABLE_TENANT_MODELS`), `/internal/feedback*` (consola de plataforma, cross-tenant) y el worker de entrega de webhooks (lee por id de webhook, sin organización). El SQL crudo de inventario filtra solo por `variant_id`.
- [~] DT-IDEM-3: **hecho (2026-11-03)** en la entrega de webhooks salientes de sass-back: el id (`eventId`) y el `timestamp` se fijan al encolar, viajan en el cuerpo firmado y en `X-Webhook-Id`/`X-Webhook-Timestamp`, los reintentos reenvían el MISMO id y el `jobId` (`webhook:eventId`) evita encolar dos veces. **Falta** (en `pagos-back`): tabla `IdempotencyKey`, dedupe de webhooks de pago entrantes e `Idempotency-Key` en cobros.
- [x] DT-IDEM-3 (pagos entrantes, ecommerce-back): tabla `idempotency_keys` (migración `20261103140000`, con RLS), `IdempotencyService` (claim atómico por organización+ámbito+clave, réplica de la respuesta, 422 si la clave cambia de contenido, 409 si está en curso, libera el claim si falla, retoma claims huérfanos a los 60 s) y `PaymentConfirmationService.confirm()`: transición `PENDING_PAYMENT→PAID` por UPDATE condicional, rechaza monto distinto y un segundo pago sobre orden ya pagada (cobro duplicado), historial y evento `order.paid`. 13 tests contra Postgres real. **Aún sin ruta**: exponerlo requiere el contrato con `pagos-back` y su autenticación (clave interna) — decisión pendiente, no se expuso a ciegas. **Aplicar la migración en Railway antes de usarlo.**
- [x] DT-EVT-1 (código, 2026-11-04): publisher real del outbox. `WebhookOutboxPublisher` entrega `order.created` / `order.paid` a los webhooks salientes de la organización vía `POST /internal/organizations/:id/events` del sass-back (INTERNAL_API_KEY, idempotente por `eventId`: el reintento at-least-once del relay no encola dos veces). `OUTBOX_PUBLISHER=logging` vuelve al publisher que solo registra. **Para activarlo en Railway:** `OUTBOX_ENABLED=true` y `OUTBOX_RELAY_ENABLED=true` en el ecommerce-back, `INTERNAL_API_KEY` igual en ambos y `ORGANIZATIONS_SERVICE_URL`. Falta una prueba con eventos reales contra Redis/sass-back (DT-OUTBOX-2).
- [~] DT-TENANT-2: `prisma/rls/enable-rls.sql` + `runAsTenant` listos y **sin aplicar** en ecommerce-back; **desde 2026-11-04 sass-back tiene sus scripts** (`prisma/rls/enable-rls.sql` / `disable-rls.sql`, 6 tablas, con spec que los compara contra `TENANT_MODELS`) y `tenant-context.ts`. En el ecommerce-back, checkout, cancelar/pagar/vencer y confirmación de pagos ya corren bajo `runAsTenant`/contexto de sistema. Falta: rol de aplicación no superusuario, que el RESTO de las queries de ambos backs corran bajo `runAsTenant` (en sass-back, ninguna todavía: el encabezado del SQL lista qué), y la prueba en staging.
- [~] DT-OUTBOX-2: probados contra Postgres real (solo lectura): migración, `forTenant`, `set_config`, SQL del claim. **Falta:** relay con eventos reales, aislamiento entre ≥2 organizaciones con datos, y las políticas RLS en staging.

## Tests — estado y pendientes (2026-11-03, cierre)

`pnpm -r test` y `pnpm -r typecheck` en verde. Suites por workspace: sass-back 430 unitarios + 23 de integración · ecommerce-back 288 + 33 de integración · storefront 210 · sass-front 115 · dashboard-front 62 · `@real/ui` 87 · `@real/auth-server` 72 · `@real/auth-client` 59 · `@real/i18n` 11 · `@real/trpc` 4 (contrato). Aparte, **31 e2e en navegador real** (escritorio y celular) contra el stack completo: sass-back, ecommerce-back, los 3 fronts, Postgres y el **emulador de Firebase Auth** (corre en Node, no necesita Java).

**Cobertura medida (honesta: cuenta el código sin tests, no solo el que algún test importa)**

| Workspace | Líneas | Piso de CI |
|---|---|---|
| sass-back (con Postgres / sin) | 92 % / 83 % | `test:cov:full` 90 % · `test:cov` 82 % |
| ecommerce-back (con Postgres / sin) | 93 % / 82 % | `test:cov:full` 90 % · `test:cov` 82 % |
| dashboard-front | 92 % | 90 % |
| sass-front | 82 % | 80 % |
| `@real/auth-server` | 87 % (**guards 100 %**) | 80 % y guards 100 % |
| `@real/auth-client` | 81 % | 78 % |
| storefront | 58 % (la lógica pura i18n/seo/catálogo ≥ 85 %) | 56 % |
| `@real/ui` | 36 % | 30 % |

Antes de esta sesión: sass-back 29,7 %, ecommerce-back 59,8 %, y los fronts/packages no se medían. Los pisos son de **no retroceso**: subirlos al cubrir más, nunca bajarlos.

### Hecho (todo verificado en esta máquina)

- [x] **DT-TEST-03** — Postgres real (`db-integration.spec.ts`, `repositories.integration.spec.ts` en ambos backs): RLS con un rol que no es superusuario, aislamiento entre organizaciones en CADA repositorio Prisma, checkout con `FOR UPDATE` bajo 12 llamadas simultáneas (verificado por mutación), sin sobreventa, outbox con `SKIP LOCKED`, sesiones de dispositivo. `pnpm --filter <back> test:db:setup` y luego `test:integration` / `test:cov:full`.
- [x] **DT-TEST-04** — e2e Playwright en `e2e/` (`pnpm e2e`, ver `e2e/README.md`): storefront público; **login del cliente (Google vía emulador) → compra → pedido, con efectos reales en la base**; aislamiento entre dos clientes (UI y llamando al back con su propio token); cerrar sesión; **login del dueño → sesión compartida con el dashboard → «Dispositivos» → cerrar sesión / cerrar OTRA sesión**; referidos. Cierra DT-SES-06 y DT-TEST-02.
- [x] **DT-TEST-05** — render con DOM en los 4 fronts y 3 packages (`@real/ui` 87, `AuthProvider` 28, hooks de datos, secciones de claves/webhooks/WhatsApp, flujo de compra del storefront, `TrpcProvider`, hooks optimistas con rollback —verificado por mutación—).
- [x] **DT-TEST-06** — cobertura medida en todo el monorepo y pisos en CI (`ci-integration.yml`, `ci-*-front.yml`, `ci-packages.yml`).
- [x] **DT-TEST-07** — `todo` borrados o convertidos en tests reales. **DT-TEST-08** — contrato de `@real/trpc` (verificado por mutación). **DT-TEST-10** — stack de jest silenciado. **DT-TEST-11** — el aviso de React por el `<script>` del JSON-LD es solo de desarrollo (patrón que recomienda Next para JSON-LD): no es un bug. **DT-TEST-12** — era diseño (la cola de webhooks siempre necesita Redis): el job e2e de CI levanta un Redis de servicio. **DT-TEST-13** — repositorios Prisma de sass-back cubiertos.
- [x] **Contratos de acceso** (`access-matrix.spec.ts`, ambos backs): clasifica TODOS los procedures por llamante; un procedure nuevo sin clasificar o con otra protección rompe el test.
- [x] **Guards al 100 %** (`FirebaseAuthGuard` no tenía ningún test; ahora cubre Bearer, cookie con revocación, Bearer inválido que no cae a la cookie, `@Public`).
- [ ] **DT-TEST-09** — el CI sigue **sin haberse corrido en GitHub Actions** (no hay forma de verificarlo desde acá). Workflows listos: `ci-integration.yml` (Postgres + Redis de servicio, integración, cobertura completa de ambos backs, e2e), test de contrato de `@real/trpc` y cobertura con umbral en los fronts y packages.

### Bugs reales que encontraron los tests (corregidos, cada uno con su test)

1. **SSRF**: `https://[::ffff:127.0.0.1]` pasaba el filtro de webhooks (Node lo normaliza a `::ffff:7f00:1`).
2. **ecommerce-back respondía 500 en vez de 404/409** (sus procedures no traducían las excepciones de Nest): un producto inexistente daba 500 en el storefront.
3. **Página de categoría del storefront daba 500** (`Link` a un componente de cliente) y **el 404 de tienda inexistente** era el genérico de Next (`not-found` inalcanzable).
4. **`configFlags.update`**: un colaborador podía cambiar el rollout aunque la documentación dice que solo el dueño.
5. **Los productos nuevos no tenían fila de stock** → `adminInventory.setStock` daba 404 para todo producto creado desde el panel. Ahora `createProduct` la crea y una migración (`20261103120000_backfill_inventory_items`) rellena las faltantes.
6. **El historial de estados de la orden nunca se escribía** (`order_status_events`). Ahora lo escriben el checkout, `create` y `updateStatus`.
7. **DT-ORDER-STATE**: la máquina de estados usaba `PENDING/CONFIRMED` y la base `PENDING_PAYMENT/FULFILLING`; una orden nueva no tenía transiciones válidas. Alineada con el enum real (`PENDING_PAYMENT→PAID/CANCELLED`, `PAID→FULFILLING/REFUNDED`, …) y un test exige que cada valor del enum tenga entrada. El dashboard también etiquetaba con los estados viejos (una orden nueva se veía sin etiqueta): corregido, y el contrato de `@real/trpc` ahora lo detecta.
8. **Dispositivo cerrado desde «Dispositivos» volvía a entrar solo** (Firebase solo revoca por usuario y el dispositivo re-creaba su cookie). Ahora `POST /auth/session` rechaza (401) un login cuyo `auth_time` es anterior a la revocación de ese dispositivo; un login nuevo sí pasa; el cliente cierra su Firebase local. Verificado en navegador (dos dispositivos).
9. **Programa de referidos muerto**: nunca se creaba `AffiliateData` (`affiliates.me` siempre 404 y el contador nunca sumaba) y el usuario nuevo no guardaba `referredByCode` (la lista salía vacía). Ahora todo usuario tiene su perfil y el referido queda asentado. Verificado en e2e.
10. **`customer.deleteAccount` era un procedure público** que anonimizaba a cualquier cliente con solo su id (y no estaba montado, así que el derecho al borrado no existía). Reemplazado por uno que solo opera sobre el propio cliente autenticado y borra también direcciones y actividad; las órdenes se conservan (registro contable).
11. `buildThemeCSS` (sass-front) inyectaría HTML del dueño tal cual (`</style><script>…`): endurecido. `useSessionWatch` dejaba una promesa rechazada sin manejar.
12. Código muerto `findBySession*` (buscaba un email `guest_…@guest.local` de cuando había invitados): eliminado.

### Abierto (con motivo)

- [x] **DT-ORDER-STOCK** (2026-11-04): ciclo completo del stock de una orden, siempre en la MISMA transacción que el cambio de estado y con UPDATE condicional (`status = PENDING_PAYMENT`: un pago y una cancelación/vencimiento simultáneos no pueden ganar los dos; el que pierde recibe Conflict y no toca el stock). **Cancelar** devuelve lo reservado a `available`; **pagar** (a mano con `updateStatus` o por `PaymentConfirmationService`) convierte lo reservado en vendido (baja `reserved`); **vencer**: `OrderExpiryService` cancela las `PENDING_PAYMENT` de más de `ORDER_PAYMENT_TTL_HOURS` (48 por defecto), con `reason` en el historial. **Apagado por defecto** (`ORDER_EXPIRY_ENABLED=true` para activarlo: cancela pedidos de clientes). Tests contra Postgres real en `order-cancel.integration.spec.ts` (6). Pendiente de producto: reembolso (`REFUNDED`) no devuelve stock a propósito (la mercadería puede no volver).
- [x] **UI de «Eliminar mi cuenta»** en el storefront (2026-11-04): botón en el panel del avatar → `AlertDialog` de confirmación → `customer.deleteAccount` → cierra sesión. 5 idiomas, 3 tests de render (no borra sin confirmar, borra y cierra sesión, error sin cerrar sesión). Sin probar en navegador.
- [ ] Cobertura del storefront (58 %: faltan `store-header`, `auth-dialog`, el layout, los adaptadores de envío y las rutas legacy `(site)`) y de `@real/ui` (36 %: la mayoría son envoltorios de Radix).
- [ ] Redis real y Firebase real fuera del emulador solo se ejercitan en CI (no hay Redis en esta máquina).
- [ ] DT-WA-07: prueba con un número real de Meta. DT-DESK-12/13: e2e del escritorio (necesita el Rust compilado).

## Sigue abierto (sin decisión o sin tiempo, ver cada línea)

- **DT-SES-04** mail de dispositivo nuevo: necesita elegir un proveedor de mail (checklist R4 de ADR-018) y un dueño.
- **DT-SES-09** unificar el `AuthContext` de `sass-front` con el `AuthProvider` compartido: refactor grande de auth sin pruebas en navegador; no se hizo a ciegas.
- **DT-CI-01** lint de los fronts: no se puede probar sin GitHub Actions. (**DT-CI-02** resuelto 2026-11-03.)

---

## Sesiones y dispositivos — ADR-020 (2026-10-16)

- [x] DT-SES-01: F1 registro + `sessions.list` + modal · F2 revocar por sesión / las demás
- [x] DT-SES-02: purga de `UserSession` vencidas (cada 24 h, dentro del sass-back)
- [x] DT-SES-03: modal en `realsass-sass-front` (`/profile`) y en dashboard-front
- [ ] DT-SES-04: F3 mail de dispositivo nuevo — necesita proveedor de mail (checklist R4 de ADR-018) y dueño
- [x] DT-SES-05: `realsass-ecommerce-back` no chequea `__sid`: una sesión cerrada sigue válida contra ese back
- [x] DT-SES-06: tests del flujo `POST /auth/session` → `__sid` → revoke → 401 (e2e en navegador y contra Postgres real; ver «Tests»)
- [x] DT-SES-07: sesión compartida entre fronts — `@real/auth-client` (AuthProvider) y `sass-front/context/auth-context.tsx` autentican por cookie si no hay usuario de Firebase en el origen
- [x] DT-SES-10: sesión en vivo entre fronts (`auth.ping` + `useSessionWatch`); límite: entre orígenes distintos se ve al volver a la pestaña o en ≤30 s
- [ ] DT-SES-11: cada pestaña visible hace un `auth.ping` cada 30 s al sass-back; si la carga molesta, subir el intervalo o pasar a SSE
- [x] DT-DASH-CTX: dashboard-front — las consultas `trpc.*` (sass-back) iban al ecommerce-back por compartir `TRPCContext`; `ecommerceTrpc` ahora tiene contexto propio. Faltan tests que lo detecten (render con ambos providers)
- [x] DT-AUTH-PERF: arranque lento de `/profile` — perfil por cookie primero, sync en segundo plano, prefetch SSR con la queryKey correcta, skeleton en vez de usuario por defecto
- [ ] DT-AUTH-PERF-2: el prefetch SSR solo existe en `/profile`; replicarlo en las demás páginas autenticadas, y evaluar `auth.sync` solo cuando haga falta (hoy corre en cada carga)
- [x] DT-AUTH-F5: muchos F5 en `/profile` agotaban el límite de `POST /auth/session` (10/min) y dejaban `sessionReady=false`; cookie recreada como máximo cada 30 min, tolerancia a 429, botón Dashboard espera la sesión, avatar con `referrerPolicy=no-referrer` (Google devuelve 429 al hotlink con Referer)
- [ ] DT-AUTH-F5-2: `auth.sync` y `/auth/session` siguen siendo las únicas llamadas con límite; evaluar subir el límite `auth` en dev o exentar el refresh con sesión válida
- [x] DT-STORE-429: el storefront dejaba de cargar tras ~10 vistas/min: `GET /organizations/public/by-slug/:slug` (sass-back) caía en el limitador `auth` (10/min, pensado para login) y en el global (30/min), y todo el tráfico del storefront sale de una IP. Ahora esa ruta salta el limitador `auth` y permite 600/min; `StoreService.resolveBySlug` (ecommerce-back) cachea 60 s, comparte consultas simultáneas y ante una falla del sass-back sirve la última copia buena hasta 10 min (un 404 nunca se tapa)
- [x] DT-STORE-1 (2026-11-04): los controllers `/internal/*` del sass-back saltan el limitador `auth` y tienen tope propio de 600/min; `/health` (ambos backs que lo tengan con Throttler) no se limita. El ecommerce-back no usa Throttler.
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
- [x] **[DT-DOCKER-01] `docker build` real** (resuelto 2026-11-03) de los 3 fronts y de los 2 backs. Lo verificado hasta ahora son los
  comandos de cada stage y el arranque del runtime emulado, sin Docker. Railway valida la sintaxis (ya mostró un error).

### Pendiente — P1

- [ ] [DT-CI-01] `ci-*-front.yml` corren `lint` y `build`; el lint de los fronts no se verificó.
- [x] [DT-CI-02] Workflows unificados (2026-11-03): se borraron los 7 duplicados (`packages`, `real-ecommerce-front`, `realsass-*`, `trpc-contract`); quedan 11 (`ci-*` + `desktop-release`). Lo único que aportaban, `pnpm audit`, pasó a `ci-global`. Sin verificar en Actions (DT-TEST-09).
- [ ] [DT-SF-01] `sass-front`: `UserProfile.isOwner` no existe en el contrato; "dueño" se deriva de
  `profile.organization !== null`. Confirmar la regla.
- [ ] [DT-DASH-01] ecommerce-back: procedure para editar variantes (SKU/precio) y para cambiar el estado de un
  pedido; el dashboard no puede hacerlo hoy.
- [ ] [DT-DASH-02] `features/chat`: unificar `hooks.ts`/`hooks/` y `types.ts`/`types/` en un único shape de
  chat-ia-back; hoy conviven tres.
- [~] [DT-DASH-03] 2026-11-04: borrados los servicios REST legacy sin uso de `config-flags`, `config-quotas`, `config-themes` y `config-webhooks`. **Falta** migrar `campanas` / `pagos` fuera de `lib/api-client.ts` cuando esos servicios tengan router tRPC.
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

### [WEL-01] Migración Prisma — ✅ resuelto 2026-11-03
```bash
cd realsass-sass-back
pnpm prisma migrate dev --name add-superadmin-org-fields
cd ../realsass-ecommerce-back
pnpm prisma migrate dev --name add_market_fields_to_order
```
Sin esta migración, el deploy en Railway falla al arrancar.

### [WEL-02] INTERNAL_API_KEY en Railway — ✅ resuelto 2026-11-03
Variable de entorno en realsass-sass-back.
Sin esto, grupojl-control recibe 403 en /internal/organizations.

### [WEL-03] pnpm prisma generate en ambos backs — ✅ resuelto 2026-11-03
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
- [x] Migraciones Prisma en sass-back + ecommerce-back — ver WEL-01 (resuelto 2026-11-03)

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
- [x] DT-UI-02: verificado 2026-11-04 — ningún front define `maximumScale` ni `userScalable` (solo los menciona la documentación de `realsass-design-front`).
- [ ] DT-UI-03: **auditar los 3 fronts** contra los 6 pilares (storefront primero): navegación por tamaño, objetivos táctiles ≥44 px, dependencia de hover, estados cargando/vacío/error/sin permisos, valores hardcodeados.
- [ ] DT-UI-04: Core Web Vitals del storefront: medir LCP/INP/CLS (hoy sin medición) y fijar umbral en CI.
- [ ] DT-UI-05: accesibilidad: pasar axe/Lighthouse sobre las pantallas principales (contraste AA, foco, `prefers-reduced-motion`).

## Norte de tipos (ADR-030, 2026-11-03)

- [x] Cero `any`, `as any`, `as never`, `as unknown as` y `@ts-ignore` en producción (comprobado por `scripts/check-type-safety.mjs --check`, en `ci-global`). Bordes resueltos con Zod (`toJsonObject`, esquemas de jobs/respuestas/caché), helpers de request de `@real/auth-server` (`headerOf`, `cookieOf`, `bearerOf`, `messageOf`, `errorMessage`) y mapeadores Prisma→dominio. Bug real hallado y corregido: `OrgForm` borraba la descripción al guardar.
- [~] Quedan **80 `as Tipo`** y **30 `!`** sin marcar (casi todos en fronts: eventos del DOM, refs). Línea base en `scripts/type-safety.baseline.json`: solo puede bajar; los casts legítimos llevan `// @real/cast:<tipo> motivo`.
- [x] Cross-tenant: `realsass-sass-back/src/prisma/cross-tenant.spec.ts` exige que todo repositorio Prisma tenga su caso de aislamiento en `repositories.integration.spec.ts`; el ecommerce lo cubre `tenant-scope.integration.spec.ts` + `access-matrix.spec.ts`.
- [x] `@real/trpc`: `test/surface.test.mjs` (exports, hoja de markets, access-matrix ↔ dist). 11 tests.
- [ ] Sin cambio: Tauri sin compilar y app de Meta sin crear (requieren entorno/cuenta que no hay acá).

## Auditoría de dependencias — 2026-11-05

- [x] `pnpm audit`: de 71 vulnerabilidades (7 críticas, 20 altas) a 1 baja. `pnpm audit --prod` limpio. Todo se resolvió en el workspace (`pnpm-workspace.yaml`, ADR-018): catalog `next ^16.4.5`, `zod ^4.6.7`, `joi ^18.3.2`, `vitest`/`@vitest/ui` `^4.1.12`, `@vitest/coverage-v8 4.1.12`, `vite ^7.3.7`; más overrides para transitivas (`sharp`, `multer`, `handlebars`, `proxy-addr`, `body-parser`, `systeminformation`, `@grpc/grpc-js`, `qs`, `glob`, `minimatch`, `fast-uri`, `re2js`, `@fastify/busboy`…).
- `vite` está declarado en las `devDependencies` de la **raíz** (`catalog:`): sin eso pnpm mantenía `vite@7.3.6` para todos los paquetes con vitest (peer resuelto desde la raíz del workspace).
- `@vitest/mocker` se acota a `~4.1.12`: un override abierto (`>=`) instala la 5.x, incompatible con vitest 4.
- [ ] DT-DEP-1: queda `deepmerge` (baja, **solo dev**: `@nestjs/cli` → `fork-ts-checker-webpack-plugin` en ecommerce-back). El aviso no tiene versión corregida; revisar al actualizar `@nestjs/cli`.
- Los overrides son deuda a vigilar: al subir la dependencia directa que los trae, retirar el override que ya no haga falta.
