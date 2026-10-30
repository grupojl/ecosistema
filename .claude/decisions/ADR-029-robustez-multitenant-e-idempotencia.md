# ADR-029 — Aislamiento por tenant, idempotencia transaccional y eventos (por fases)

**Estado:** aceptada · 2026-10-30 · fase 1 implementada y activa; fases 2–4 **implementadas y verificadas con tests, pero apagadas / sin aplicar en la base** (ver "Activación").

## Contexto

Revisión externa del proyecto propuso tres refuerzos: aislamiento de tenant a nivel base de datos, idempotencia tipo bancario y un
patrón Transactional Outbox. Se verificó el código (2026-10-30): **ninguno existía**.

- El aislamiento depende de escribir `where: { organizationId }` a mano en cada query (~570 menciones solo en `realsass-ecommerce-back`;
  114 usos de `$transaction` / SQL crudo entre ambos backs). Ya hubo fallas de esta clase: `markets.*` público y carrito sin dueño (ver deuda técnica 2026-10-16).
- No hay `Idempotency-Key` ni tabla de idempotencia. El checkout se protegía por el estado del carrito, pero **`Order.cartId` es `@unique`**: dos
  checkouts simultáneos NO crean dos órdenes; el segundo falla por la restricción y revierte su reserva de stock → el cliente recibía un error confuso
  en un reintento legítimo (doble clic, corte de red). Es un problema de UX/robustez, no de cobro duplicado (todavía no hay pagos).
- No hay outbox. Los eventos son `EventEmitter2` en memoria (se pierden si cae el proceso) y una cola BullMQ de webhooks salientes.

## Decisión

Se adopta el rumbo de las tres propuestas, **por fases y atado a la necesidad real**, no todo de golpe:

| Fase | Qué | Cuándo | Estado |
|---|---|---|---|
| 1 | **Checkout idempotente**: bloqueo de la fila del carrito (`SELECT … FOR UPDATE`) y, si el carrito ya está `CONVERTED`, se devuelve la orden existente (sin reservar stock otra vez). La clave natural de idempotencia es `cartId` (`Order.cartId` UNIQUE). | ya | ✅ implementada |
| 2 | **Prisma Client Extension de tenant** (`prisma.forTenant(orgId)`, `src/prisma/tenant-scope.ts`): inyecta `organizationId` en toda query de un modelo con tenant y **lanza** si la query apunta a otra organización o intenta mover una fila. Un test compara la lista de modelos con `schema.prisma`. Primero `ecommerce-back`. | antes de clientes reales con datos sensibles | ✅ **adoptada en los 5 repositorios del ecommerce-back y en `ActivityService`**; verificada contra Postgres real. Falta sass-back y el SQL crudo |
| 3a | **Outbox transaccional** (`src/outbox/`, tabla `outbox_events`): el checkout escribe `order.created` en la MISMA transacción que la orden; un relay con `FOR UPDATE SKIP LOCKED` lo publica (at-least-once, reintentos con espera creciente, tope de 10 intentos). Publisher intercambiable (hoy solo registra). | ya | 🟡 migración **aplicada** (2026-10-30); escritura y relay **apagados** (`OUTBOX_ENABLED` / `OUTBOX_RELAY_ENABLED`) hasta tener un consumidor real |
| 3b | **Idempotencia de pagos**: tabla `IdempotencyKey` (única por organización + clave), eventos de webhook ya procesados, `Idempotency-Key` en las mutaciones de cobro. | junto con la integración de pagos (`pagos-back`) | ⏳ pendiente |
| 4 | **RLS en Postgres** como segunda red de seguridad: `prisma/rls/enable-rls.sql` (+ `disable-rls.sql`), `runAsTenant` / `setTenantContext` fijan `app.organization_id` por transacción. | cuando todas las queries de tenant usen `runAsTenant` | 🟡 script y helpers listos, **sin aplicar** |

## Activación (nada de esto cambia el comportamiento hasta que se haga a propósito)

**Outbox**
1. Aplicar la migración `20261030150000_outbox_events` (`pnpm --filter realsass-ecommerce-back exec prisma migrate deploy`).
2. `OUTBOX_ENABLED=true` (el checkout empieza a escribir eventos) y `OUTBOX_RELAY_ENABLED=true` (el relay los publica).
3. Reemplazar el provider `OUTBOX_PUBLISHER` por un consumidor real (WhatsApp, notificaciones…). Los consumidores deben ser **idempotentes**: la entrega es at-least-once y el `id` del evento es la clave.

**Tenant en el cliente Prisma**: hecho en los repositorios del ecommerce-back. Para el código nuevo: `prisma.forTenant(organizationId)` en vez de `prisma`, y `runAsTenant` para las transacciones. No cubre SQL crudo (`$queryRaw`/`$executeRaw`) ni el cliente interactivo de `$transaction` (no admite `$extends`): ahí el filtro de organización sigue siendo manual (checkout, `reserveWithinTransaction`). Modelos hijos sin `organizationId` (`CartItem`, `OrderItem`…) se alcanzan por su padre, que se verifica antes.

**RLS** (en este orden): staging con copia de datos → rol de aplicación no superusuario (un superusuario ignora RLS; el usuario por defecto de Railway lo es) → todas las queries bajo `runAsTenant` → `enable-rls.sql`. Sin el paso 3, la tienda devuelve 0 filas (falla cerrado). Reversa: `disable-rls.sql`.

## Por qué en este orden

- La fase 1 corrige un fallo real con cambio mínimo y sin migración.
- La fase 2 es la de mayor retorno de seguridad: convierte "acordarse del `where`" en algo que el código no permite olvidar. RLS (fase 4) cuesta más
  (SQL crudo, rol de la base, pooling de Railway, jobs sin tenant, fijar el tenant por transacción) y solo agrega valor sobre la fase 2.
- El outbox hoy sería sobreingeniería: casi no hay eventos entre servicios. Se justifica cuando haya eventos de dinero.

## Reglas

- Una mutación que mueva dinero o stock DEBE ser idempotente: reintentarla devuelve el resultado original, nunca lo repite.
- Una operación idempotente se serializa con un bloqueo de fila (`FOR UPDATE`) filtrado por organización **y** dueño; no se confía en leer-y-luego-escribir.
- Fase 2 en adelante: una query sin tenant en un modelo con tenant es un error de compilación o de ejecución, nunca un filtro omitido.

## Verificación de las fases 2–4

`realsass-ecommerce-back`, solo con tests unitarios y mocks: `tenant-scope.spec` (alcance, rechazo de otro tenant, `OR`/`in`/`not`, coherencia con `schema.prisma`), `tenant-context.spec`, `rls-script.spec` (el script cubre exactamente las tablas con tenant; no está en `migrations/`), `outbox.spec` (relay, backoff, ciclo de vida) y `orders.outbox.spec` (el evento nace en la misma transacción; sin PII; el reintento no duplica).
**Contra Postgres real (2026-10-30, solo lectura)** — `pnpm --filter realsass-ecommerce-back test:db` (`tenant-scope.integration.spec.ts`, 8 pruebas): `forTenant` funciona sobre el cliente con el adaptador `pg`; un tenant ajeno no lee ni modifica datos de otro aunque conozca el id; la suma de filas por organización coincide con el total; `set_config` por transacción llega a Postgres y no se filtra al pool; la tabla `outbox_events` existe y el claim `FOR UPDATE SKIP LOCKED` es SQL válido.
**Límite de esa prueba:** la base de desarrollo tiene UNA organización con datos y 0 órdenes, así que el aislamiento entre dos organizaciones reales y el outbox con eventos no se ejercitaron de punta a punta. **Sigue sin verificar:** las políticas RLS (`enable-rls.sql`) y el relay publicando eventos reales.

## Verificación de la fase 1

`realsass-ecommerce-back`: `orders.service.spec.ts` cubre el bloqueo previo a la lectura, el reintento sobre carrito `CONVERTED` (misma orden, sin
reservar ni crear) y que un carrito `ABANDONED` no se puede pagar. 13/13 suites. **Falta** una prueba contra Postgres real con dos peticiones
concurrentes (el mock no ejercita `FOR UPDATE`).
