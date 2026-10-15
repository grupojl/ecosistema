# Pilares del ecosistema — línea base de auditoría

> **Documento dinámico (snapshot).** Responde "¿cómo está esto hoy?". Se actualiza al cerrar un pendiente o al
> re-puntuar; el criterio de 10/10 de la seguridad por capa vive en `architecture/13-seguridad-por-capa-norte.md`
> (contrato) y las decisiones en `decisions/`. **No se edita una nota sin la evidencia que la justifica.**

| | |
|---|---|
| **Línea base** | 2026-10-15 · rama `feat/seguridad-por-capa-rls` · commit `e974fc2` |
| **Quién puntuó** | Claude (Sonnet 5.5), a partir de lo ejecutado en la sesión. **No hubo revisión externa ni pentest.** |
| **Escala** | 1–10. 10 = la garantía no depende de que alguien se acuerde y un test o una auditoría falla si se rompe. |
| **Promedio** | **7,7 / 10** |
| **Veredicto** | Listo para un **staging cerrado** (usuarios de confianza, sin pagos reales). **No** para producción abierta. |

## Resumen

| # | Pilar | Nota | Condición para subir |
|---|---|:-:|---|
| 1 | Arquitectura y contratos | **9** | Tipos de fecha del contrato (`Date` vs string) |
| 2 | Aislamiento multi-tenant | **8,5** | RLS fase 2 en sass-back; probar en Railway |
| 3 | Seguridad de aplicación | **8,5** | CSP con nonces; revisión externa |
| 4 | Calidad y tests | **8,5** | E2E en navegador; más cobertura en los fronts |
| 5 | Integridad de datos y concurrencia | **9** | Backups y prueba de restauración |
| 6 | Entrega y despliegue | **7** | Correr el CI en GitHub; desplegar a staging |
| 7 | Operación y observabilidad | **5** | Alertas, backups, runbook probado, OTEL |
| 8 | Frontend, SEO e i18n | **7** | E2E de login/checkout; quitar stubs y mocks |
| 9 | Cadena de suministro | **9** | Rotación de secretos probada en un entorno real |
| 10 | Completitud del producto | **5** | Servicio de pagos; cuentas recurrentes |

Los pilares técnicos (1–5 y 9) están entre 8,5 y 9. El promedio lo arrastran los de entrega, operación y producto (6, 7, 10).

---

## 1. Arquitectura y contratos — 9

**Qué es 10:** un contrato entre front y back que no se puede romper sin que falle el build; capas con una sola responsabilidad.

**Evidencia**
- tRPC de punta a punta; los fronts leen los tipos del `dist` de `@real/trpc` (ADR-019), sin `any`.
- Capas router → service → domain → repository (`architecture/01-backend-capas.md`), con una 7.ª capa de aislamiento por fila (ADR-027).
- Typecheck de los 3 fronts contra el contrato real tras regenerarlo (`pnpm contracts`); `pnpm build` de los 8 workspaces con exit 0.
- 27 ADRs; contrato separado de snapshot (`CLAUDE.md`).

**Falta:** los tipos de fecha del contrato dicen `Date` pero viajan como string (cliente tRPC sin transformer).

## 2. Aislamiento multi-tenant — 8,5

**Qué es 10:** dos capas independientes (aplicación y base); olvidarse del `organizationId` no filtra datos.

**Evidencia**
- RLS forzado y default-deny en ecommerce-back (12 tablas, las hijas heredan) y en sass-back fase 1 (secretos, webhooks + log, cuotas, mercados). ADR-027.
- `rls.int-spec` en cada back, **contra Postgres 16 real y con el rol `eco_app`** (sin `SUPERUSER` ni `BYPASSRLS`): sin alcance no se ve nada, un `findMany` sin `where` solo devuelve lo propio, no se lee/inserta/actualiza/borra/mueve una fila ajena, 200 consultas intercaladas de dos organizaciones no se cruzan.
- **Mutación:** con el rol administrador (que saltea RLS) fallan 12 de 14 → los tests sí prueban la base.
- **Ambos backs en contenedor, en producción, como `eco_app`** (Postgres 16 y Redis 7 en Docker): arrancan, migran con el dueño (`MIGRATION_DATABASE_URL`), health `ok` con db y redis arriba, sin el aviso de RLS; ecommerce-back con 12 tablas con RLS forzado y sass-back con 5. Con un superusuario **ninguno de los dos arranca**.
- Auditorías S8 (`runAsSystem`), S9 (cableado idéntico en ambos backs), C4 (`organizationId` en las consultas).

**Falta**
- **Fase 2 en sass-back:** collaborators, invitations, users, organizations, affiliate_data y las tablas con filas globales (`organizationId NULL`). Se consultan antes de conocer la organización; hacerlas a ciegas rompería el login.
- **No probado en Railway** (rol `eco_app`, `MIGRATION_DATABASE_URL`).
- **No se midió la latencia** del `set_config` por conexión.

## 3. Seguridad de aplicación — 8,5

**Qué es 10:** nada que el cliente pueda fabricar es una credencial; todo falla cerrado; todo secreto es rotable.

**Evidencia**
- Identidad solo desde cookie HttpOnly firmada; CORS con lista explícita; servicios que no arrancan sin secretos; claves de servicio rotables y comparadas en tiempo constante; anti-SSRF en webhooks; timeouts y circuit breaker (ADR-023).
- Rate limit de `/trpc` compartido entre réplicas (**probado con dos instancias sobre Redis real**) y que **degrada a un contador local** si el store falla, en vez de dejar pasar todo.
- `seguridad.sh`: C1–C8 y S1–S10 en verde. S10 detecta mutaciones públicas fuera de la lista (probado contra el router de markets original).
- **Corregido en esta línea base:** `sass-back` `markets.create/update/setDefault/delete` eran públicos y aceptaban la organización o el id por input (cualquiera podía tocar mercados ajenos); `markets.resolve` recibía `x-internal-api-key` pero nadie la validaba; `customer.deleteAccount` (código muerto, documentado como hecho) anonimizaba cualquier cuenta con solo un id.
- Guard del dueño verificado por mutación: debilitado, fallan 36 tests (sass-back).

**Falta**
- **CSP con nonces (ADR-026):** obliga a render dinámico (pierde ISR en el storefront) y solo se valida en un navegador. No implementada a propósito.
- **Revisión externa / pentest.** Que la falla de markets pasara las auditorías anteriores indica que puede haber otras de la misma clase (la auditoría C1 solo verificaba que existiera *algún* procedure).
- Rate limit más estricto y progresivo por cuenta en login/registro.

## 4. Calidad y tests — 8,5

**Qué es 10:** una regla que no falla en CI no es una regla; un test no cuenta hasta que se lo vio fallar.

**Evidencia** (todo ejecutado: `lint`, `typecheck`, `test:ci` y `build` con exit 0)

| Paquete | Tests | Cobertura de líneas |
|---|:-:|:-:|
| sass-back | 478 | 73 % |
| ecommerce-back | 330 | 75 % |
| auth-server | 71 | 68 % |
| storefront (real-ecommerce-front) | 138 | — |

- Integración contra Postgres y Redis reales: aislamiento por aplicación, RLS, concurrencia de stock, idempotencia del checkout, Redis, rate limit con dos instancias, entrega de webhooks con BullMQ.
- **Mutaciones comprobadas:** `useStore()` reintroducido (5 tests fallan), reclamo del carrito desactivado (6/6 fallan), firma del webhook alterada (falla), `enforceOwner` debilitado (36 fallan).
- Umbrales de cobertura que solo suben (sass-back 72, ecommerce-back 73).

**Falta:** E2E en navegador (login y checkout); los fronts, salvo el storefront, tienen poca cobertura; el detalle de producto y la categoría del storefront solo tienen el guard estático.

## 5. Integridad de datos y concurrencia — 9

**Qué es 10:** las invariantes del negocio las garantiza la base, no la suerte del orden de ejecución.

**Evidencia**
- Stock: `reserve`/`release` como `UPDATE` condicional atómico; **20 reservas simultáneas por 1 unidad con stock 5 → exactamente 5 ganan**; una transacción que falla revierte la reserva.
- Checkout idempotente: el carrito se reclama con un `UPDATE` atómico; **20 checkouts simultáneos del mismo carrito → 1 orden y el stock reservado una vez**; un reintento devuelve la misma orden; otro cliente no la recupera.
- Migraciones: aplican en base limpia, sin deriva contra `schema.prisma`, vigiladas por el CI; las dos nuevas (RLS) también.

**Falta:** backups y prueba de restauración; el flujo de pagos (hoy no existe, ver pilar 10).

## 6. Entrega y despliegue — 6,5

**Qué es 10:** lo que está en `main` se despliega solo, y el CI lo exige.

**Evidencia**
- `docker build` de los 5 servicios con exit 0; **los dos backs arrancaron en contenedores reales** (health `ok`, db y redis arriba) y, en el servicio real, `markets.resolve` sin clave de servicio y `markets.create` sin sesión responden 401.
- `ci.yml` unificado (calidad, tests, integración con Postgres + Redis y rol `eco_app`, `pnpm audit`, auditorías) + escaneo de secretos.
- 7 commits ordenados en `feat/seguridad-por-capa-rls`; árbol limpio.

**Falta**
- **El CI nunca corrió en GitHub** y no hay branch protection.
- **Nada desplegado en Railway.**
- Los 3 fronts construyen pero no se arrancaron en contenedor.
- Las imágenes se reconstruyen sin caché de pnpm (restricción de Railway).

## 7. Operación y observabilidad — 5

**Qué es 10:** si algo falla a las 3 a. m., alguien se entera y sabe qué hacer.

**Evidencia:** logger con correlation id, métricas Prometheus, health checks (`/api/v1/health` con db y redis), skill `runbook-incidente`.

**Falta:** alertas; backups; `OTEL_EXPORTER_OTLP_ENDPOINT` sin configurar en Railway; runbook sin probar; sin medición de latencia con carga real (incluye el costo de RLS).

## 8. Frontend, SEO e i18n — 7

**Qué es 10:** la experiencia crítica (ver tienda, comprar) está probada en un navegador y no se degrada.

**Evidencia:** reglas SEO explícitas (idioma en la URL, `NOT_FOUND` → 404, otra falla → 5xx; ADR-016); test de humo del storefront (home, listado, layout) y guard de la frontera servidor/cliente; build sin `ignoreBuildErrors`.

**Falta:** E2E de login y checkout; mock de WebAuthn en `checkout-flow.tsx` y adapters de envío con stubs; `images.unoptimized`; `proxy.ts` sin test automático; storefront con `x-organization-id` fijo por variable (DT-ENV-03).

## 9. Cadena de suministro — 9

**Qué es 10:** cada dependencia entra con dueño, una versión y declarada donde se usa.

**Evidencia:** `pnpm audit` en 0 (antes 24, 3 críticas); 0 dependencias fantasma; versión única por paquete (`catalog:`); sin `shamefully-hoist`; gitleaks + hook de pre-commit; Dependabot.

**Falta:** rotación de secretos probada en un entorno real.

## 10. Completitud del producto — 5

**Qué es 10:** un cliente real puede completar el negocio de punta a punta.

**Evidencia:** catálogo, stock, carrito, órdenes, Markets, colaboradores, configuración, webhooks y documentación funcionan y están probados.

**Falta:** **no existe el servicio de pagos** (`paymentIntentId` es null); cuando exista necesita idempotencia con el proveedor, confirmación por webhook entrante firmado y transiciones de estado en un solo sentido. Cuentas recurrentes de clientes con verificación de email (ADR-025). Los eventos `config.flag.updated` / `config.theme.activated` no coinciden con los `@OnEvent('…changed')` del despachador, así que esos cambios hoy no disparan webhooks.

---

## Camino a cada nivel

**Staging cerrado** (casi listo): push a una rama y correr el CI → desplegar en Railway con el rol `eco_app` y comprobar que no aparece el aviso de RLS → definir backups.

**Producción abierta** (todavía no): RLS fase 2 · revisión de seguridad externa · CSP con nonces · alertas y runbook probado · pagos con idempotencia y webhook firmado (si van a cobrar) · E2E de login y checkout.

## Cómo se actualiza

1. Cerrar un pendiente → cambiar la nota **solo si** hay evidencia ejecutada (test, auditoría, contenedor, CI) y agregarla en el pilar.
2. Re-puntuar → copiar la tabla al historial de abajo con la fecha y el commit, y actualizar la cabecera.
3. Un pilar no sube por haber escrito la regla: sube cuando algo falla si alguien la rompe.

## Historial

| Fecha | Commit | Promedio | Cambios |
|---|---|:-:|---|
| 2026-10-15 | `e974fc2` | 7,6 | Línea base inicial. |
| 2026-10-15 | `7997d68` | 7,7 | Pilar 6: 6,5 → 7. Los dos backs arrancan en contenedor como `eco_app` y se niegan a arrancar con un superusuario. |
