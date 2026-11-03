# Camino a producción — welver

Última actualización: 2026-11-03 (MVP = cobro por transferencia fuera del sistema; Docker y Railway funcionando según el dueño)

Documento **dinámico** (snapshot del estado). Resume qué falta para que el código esté listo para producción, ordenado por cuánto bloquea.
El detalle técnico de cada deuda vive en `deuda-tecnica.md`; las decisiones, en `decisions/ADR-*.md`.

Leyenda: ✅ hecho · 🟡 parcial · ⏳ pendiente · 🔒 bloqueado por algo externo al código (cuenta, contrato, certificado, dato) · ⚪ opcional

## 🔴 Bloqueantes

| # | Qué falta | Estado |
|---|---|---|
| 1 | **Pago en línea.** Decisión (2026-10-30): el MVP cobra **por transferencia bancaria, fuera del sistema**; el checkout deja la orden en `PENDING_PAYMENT` y la tienda confirma el cobro a mano. El pago online queda para después del MVP. | ⚪ fuera del MVP |
| 2 | **Idempotencia de pagos** (ADR-029, fase 3b): hecha la parte de este repo (2026-11-03: `idempotency_keys`, `PaymentConfirmationService`, webhooks salientes con id estable). Falta conectarla a `pagos-back` y **aplicar la migración `20261103140000` en Railway** antes de usarla. | ⚪ fuera del MVP |
| 3 | **Despliegue real con Docker.** Resuelto 2026-11-03 (confirmado por el dueño): el build y Railway funcionan (DT-DOCKER-01). Queda DT-ENV-04 (puerto del ecommerce-back, 3001 vs 3005) como cosmético. | ✅ |
| 4 | **Variables de entorno de producción** (`INTERNAL_API_KEY` en ambos servicios, `COOKIE_DOMAIN`, `CONFIG_MASTER_KEY`, Firebase). Según el dueño (2026-10-30): Railway ya se probó y está configurado; no verificado desde el código. | ✅ |
| 5 | **Ejecutar el CI al menos una vez.** Workflows unificados a 11 (DT-CI-02, 2026-11-03), pero ninguno corrió en GitHub Actions (DT-TEST-09, DT-CI-01). Es lo primero de mañana: commitear y empujar. | 🟡 |

## 🟠 Alta prioridad (antes de clientes reales)

| # | Qué falta | Estado |
|---|---|---|
| 6 | **Tests e2e** de los flujos críticos. Hecho (31 e2e con el emulador de Firebase): storefront, login y compra del cliente, aislamiento entre clientes, login del dueño, sesión compartida, «Dispositivos», referidos. Falta correrlos en CI. | ✅ |
| 7 | **Checkout completo con datos reales**: la base de desarrollo tiene 1 organización y 0 órdenes. | ⏳ |
| 8 | **Prueba concurrente del checkout contra Postgres** (DT-IDEM-2). Hecha: `db-integration.spec.ts` y `checkout.concurrency.integration.spec.ts` (5 checkouts simultáneos → 1 orden; última unidad → un solo ganador). | ✅ |
| 9 | **Tenant en `sass-back`** (DT-TENANT-1): `forTenant()` ya adoptado en el ecommerce-back; falta sass-back y el SQL crudo del checkout / `reserveWithinTransaction` (filtran a mano). | 🟡 |
| 10 | **Sesión que tardaba en mostrarse**: corregida la causa probable; falta probarla en navegador. | 🟡 |
| 11 | **Observabilidad**: alertas, logs centralizados, seguimiento de errores, panel; alerta de eventos del outbox sin entregar. | 🟡 |
| 12 | **Backups y plan de recuperación** de la base de datos. | 🟡 |

## 🟡 Media

| # | Qué falta | Estado |
|---|---|---|
| 13 | **Outbox con un consumidor real** y activar `OUTBOX_ENABLED` / `OUTBOX_RELAY_ENABLED`. | ⏳ |
| 14 | **RLS**: rol de aplicación no superusuario, todo bajo `runAsTenant`, prueba en staging, luego `enable-rls.sql`. | ⏳ |
| 15 | **WhatsApp**: app de Meta (Tech Provider, App Review) y prueba end-to-end con un número real. | 🔒 |
| 16 | **Proveedor de correo** (aviso de dispositivo nuevo, DT-SES-04). | 🔒 |
| 17 | **Idioma**: textos fijos de `@real/ui`, resto de pantallas, preferencia en el perfil. | 🟡 |
| 18 | **Landing de `sass-front`**: ¿idioma por cookie o `/{locale}`? (ADR-016). | ⏳ |
| 19 | **Lint y revisión de dependencias** (`pnpm audit`). | 🟡 |
| 20 | **Higiene del repo**: >200 cambios sin commitear, archivos `.bak`, scripts sueltos. | ⏳ |

## 🟢 Fuera del camino crítico

- **App de escritorio (Tauri):** el Rust nunca se compiló; falta firma de código (certificados comprados) y reemplazar el logo (es el de Apple, marca registrada).
- **DT-SES-09:** unificar el `AuthContext` de `sass-front` con el `AuthProvider` compartido.
- `realsass-design-front` queda fuera de la traducción (documentación interna).

## Orden recomendado

1. ~~Variables de entorno (#4) y `docker build` (#3)~~ — hecho.
2. **Commitear** (#20, >200 cambios) y **ejecutar el CI**, arreglar lo que salga (#5).
3. Un pedido de prueba de punta a punta en Railway (#7).
4. Backups (#12) y observabilidad (#11, WEL-07).
5. Tenant en sass-back y RLS en staging (#9, #14); decidir DT-ORDER-STOCK (liberar stock al cancelar).
6. Pagos online con `pagos-back` (#1, #2), después del MVP.

## Registro de avance

- **2026-11-03:** Docker/Railway confirmados; idempotencia de entrada (ecommerce-back) y de webhooks salientes; prueba de concurrencia del checkout; cobertura medida y pisos en CI; 31 e2e; workflows unificados (11); cero `any`/`as unknown as` en producción (ADR-030). Detalle en `deuda-tecnica.md`.
- **Pendiente de mañana:** commit, primer CI en GitHub, pedido de prueba, backups. Migración `20261103140000` (y `20261103120000` backfill de inventario) por aplicar en Railway.
