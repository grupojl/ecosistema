# ADR-027: Aislamiento por fila en la base (Row Level Security)

**Fecha:** 2026-10-15
**Estado:** Aceptado — fase 1 implementada y verificada; fase 2 pendiente
**Alcance:** `realsass-ecommerce-back` (completo) y `realsass-sass-back` (fase 1)
**Complementa:** ADR-023 (modelo de seguridad). No lo reemplaza.

## Contexto

Hasta ahora el aislamiento entre organizaciones dependía de **una convención**: toda consulta lleva `organizationId` en
el `where`. La vigilaban una auditoría estática (C4) y los tests, pero la base no sabía nada: un `where` olvidado en un
cambio futuro filtraba datos de otra organización sin que nada lo frenara.

Con RLS la base filtra por sí misma. La convención sigue siendo obligatoria (es la primera capa y da errores claros);
RLS es la segunda, la que sostiene el aislamiento cuando la primera falla.

## Decisión

1. **Políticas por tabla.** Cada tabla con datos de negocio tiene `ENABLE` + `FORCE ROW LEVEL SECURITY` y una política
   `tenant_isolation` (`USING` + `WITH CHECK`) basada en `app_tenant_matches(organization_id)`. Las tablas hijas sin
   `organization_id` heredan la visibilidad de su padre con un `EXISTS`.
2. **Default-deny.** Sin variables de sesión, la base devuelve 0 filas y rechaza escrituras. Olvidarse de abrir un
   alcance rompe fuerte; nunca filtra.
3. **El alcance lo fija el pool, no el código de negocio.** `TenantAwarePool` (extiende `pg.Pool`) vuelca en la sesión
   de Postgres `app.organization_id` / `app.rls_bypass` al entregar **cada** conexión, tomando el alcance de un
   `AsyncLocalStorage`. Cubre las dos rutas del adaptador de Prisma (`pool.query` y `pool.connect`).
4. **Dónde se abre el alcance.** El middleware tRPC `withTenantScope` corre **después** de `enforce*` (la organización ya
   está validada contra la membresía o la sesión firmada). Los procedures públicos que reciben la tienda por input, los
   endpoints internos y los eventos abren su alcance explícitamente con `runInTenant(orgId, fn)`.
5. **Única salida: `runAsSystem(razón, fn)`.** Ve todas las organizaciones. Exige una razón y solo puede usarse desde los
   archivos de la lista de la auditoría **S8** (hoy: el worker de webhooks y el propio `tenant-context.ts`).
6. **Dos roles de base.** El dueño de las tablas corre las migraciones (`MIGRATION_DATABASE_URL`). El servicio usa
   `eco_app` (`DATABASE_URL`): sin `SUPERUSER` ni `BYPASSRLS`, sin permisos de DDL. `prisma/rls/app-role.sql` lo crea.
7. **Falla cerrado al arrancar.** `PrismaService` consulta `pg_roles`; con `NODE_ENV=production` y un rol que saltea RLS
   el servicio **no arranca** (salvo `ALLOW_RLS_BYPASS_ROLE=true`, consciente y solo para entornos efímeros).

## Trampas que este diseño ya resolvió (no volver a pisarlas)

- **Las promesas de Prisma son perezosas.** `runInTenant(org, () => prisma.x.findMany())` devolvía la consulta sin
  ejecutar y corría al hacer `await`, ya fuera del alcance (0 filas). `runInTenant`/`runAsSystem` disparan el `then`
  dentro del alcance.
- **pg-pool encola callbacks.** Con el pool agotado, el callback de `connect` se invoca desde el contexto de **otra**
  petición. El alcance se captura al *pedir* la conexión, no al recibirla.
- **Una conexión devuelta al pool no puede arrastrar el tenant anterior.** Cada entrega vuelve a fijar las variables
  (vacías si no hay alcance).
- **Un superusuario ignora RLS aunque haya `FORCE`.** Por eso el rol de aplicación y el chequeo de arranque.

## Cobertura

| Back | Tablas con RLS | Estado |
|---|---|---|
| ecommerce-back | categories, products, product_variants, inventory_items, store_customers, customer_activity_events, carts, orders (+ customer_addresses, cart_items, order_items, order_status_events por herencia) | ✅ completo |
| sass-back | secret_configs, quota_configs, webhook_endpoints, markets (+ webhook_delivery_logs por herencia) | ✅ fase 1 |
| sass-back | collaborators, invitations, users, organizations, affiliate_data | ⏳ fase 2 |
| sass-back | theme_configs, feature_flags, content_templates, config_audit_logs (filas globales `organizationId NULL`) | ⏳ fase 2 |

**Por qué la fase 2 no se hizo:** esas tablas se consultan *antes* de conocer la organización (resolver "¿a qué
organizaciones pertenece este usuario?" en la autenticación) o mezclan filas globales con propias (lectura de las
globales, escritura solo de las propias). Necesitan políticas distintas (`SELECT` permisivo para `NULL`, escritura
estricta) y una revisión del flujo de autenticación. Hacerlas a ciegas rompería el login.

## Verificación

- `rls.int-spec.ts` en cada back, **contra Postgres real y con el rol `eco_app`**: sin alcance no se ve nada; un
  `findMany` sin `where` solo devuelve lo propio; no se lee, inserta (`WITH CHECK`), actualiza, borra ni mueve una fila
  ajena; las tablas hijas heredan; las transacciones interactivas respetan el alcance; 200 consultas intercaladas de dos
  organizaciones no se cruzan.
- **Mutación:** los mismos tests corridos con el rol administrador (que saltea RLS) fallan 12 de 14. Si alguien rompe
  las políticas, o conecta el servicio con un superusuario, los tests lo ven.
- Auditorías **S8** (dónde puede usarse `runAsSystem`), **S9** (el pool y `tenant-context` son idénticos en ambos backs,
  el `PrismaService` los usa, hay migración) y **S10** (toda mutación tRPC sin sesión está en una lista explícita).
- CI: el job `integration` crea el rol, migra con el administrador y corre los specs con `eco_app`
  (`TEST_APP_DATABASE_URL` es obligatoria allí).

## Problemas reales que aparecieron al aplicarlo

| Hallazgo | Corrección |
|---|---|
| `sass-back` `markets.create/update/setDefault/delete` eran `publicProcedure` y aceptaban la organización o el id por input: **cualquiera podía crear, cambiar o borrar los mercados de otra organización**. Además `markets.resolve` recibía `x-internal-api-key` pero **nadie la validaba**. | Ahora son `ownerProcedure` con la organización del contexto; el service verifica pertenencia por id; `resolve` exige la clave de servicio (`internalProcedure`). |
| `ecommerce-back` `deleteAccount` (código muerto, pero documentado como hecho) anonimizaba **cualquier** cuenta con solo `customerId`/`organizationId` por input. | Reemplazado por `customer.deleteAccount` autenticado: el id sale de la sesión firmada. |
| `PrismaInventoryRepository.reserve/release` leían y escribían en dos pasos. | `UPDATE` condicional atómico; probado con 20 reservas simultáneas. |
| El checkout de un mismo carrito en paralelo reservaba stock dos veces y fallaba recién al insertar la orden. | El carrito se reclama con un `UPDATE` atómico; un reintento devuelve la misma orden. |
| El rate limit dejaba pasar todo si el store fallaba. | Degrada a un contador local por instancia. |

## Consecuencias

- Una consulta fuera de un alcance devuelve vacío en lugar de datos: los flujos nuevos (jobs, listeners, controllers)
  **tienen que abrir su alcance**. Es a propósito.
- Cada conexión hace un `SELECT set_config(...)` adicional (un viaje de ida y vuelta más por consulta). **No se midió**
  el impacto en latencia: medirlo con carga real es un pendiente. Si resulta relevante, las alternativas son agrupar el
  `set_config` con la primera consulta o usar `SET LOCAL` dentro de la transacción.
- Los desarrolladores locales con el superusuario de Docker no ven RLS aplicado (solo un aviso). Para probarlo hay que
  conectarse como `eco_app` (ver los specs `rls.int-spec.ts`).

## Despliegue (Railway)

1. Crear el rol en cada base, una vez, como administrador:
   `psql "$ADMIN_URL" -v app_password="'<clave larga aleatoria>'" -f prisma/rls/app-role.sql`
2. `MIGRATION_DATABASE_URL` = el dueño de las tablas; `DATABASE_URL` = `postgresql://eco_app:<clave>@…`.
3. Aplicar las migraciones (el `entrypoint.sh` ya corre `prisma migrate deploy` con `MIGRATION_DATABASE_URL`).
4. Verificar en los logs que **no** aparece el aviso "Row Level Security NO se aplica".

**No probado en Railway todavía.** Todo lo anterior se verificó en Postgres 16 local en Docker.
