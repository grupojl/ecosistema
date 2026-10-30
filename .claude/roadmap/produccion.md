# Camino a producción — welver

Última actualización: 2026-10-30 (MVP = cobro por transferencia fuera del sistema; Railway ya configurado)

Documento **dinámico** (snapshot del estado). Resume qué falta para que el código esté listo para producción, ordenado por cuánto bloquea.
El detalle técnico de cada deuda vive en `deuda-tecnica.md`; las decisiones, en `decisions/ADR-*.md`.

Leyenda: ✅ hecho · 🟡 parcial · ⏳ pendiente · 🔒 bloqueado por algo externo al código (cuenta, contrato, certificado, dato) · ⚪ opcional

## 🔴 Bloqueantes

| # | Qué falta | Estado |
|---|---|---|
| 1 | **Pago en línea.** Decisión (2026-10-30): el MVP cobra **por transferencia bancaria, fuera del sistema**; el checkout deja la orden en `PENDING_PAYMENT` y la tienda confirma el cobro a mano. El pago online queda para después del MVP. | ⚪ fuera del MVP |
| 2 | **Idempotencia de pagos** (ADR-029, fase 3b): `IdempotencyKey` y webhooks deduplicados. Solo hace falta cuando exista el pago online. | ⚪ fuera del MVP |
| 3 | **Despliegue real con Docker.** Nunca se hizo un `docker build`; healthchecks con ruta y puerto equivocados (DT-DOCKER-01, DT-ENV-04). | 🟡 |
| 4 | **Variables de entorno de producción** (`INTERNAL_API_KEY` en ambos servicios, `COOKIE_DOMAIN`, `CONFIG_MASTER_KEY`, Firebase). Según el dueño (2026-10-30): Railway ya se probó y está configurado; no verificado desde el código. | ✅ |
| 5 | **Ejecutar el CI al menos una vez** (17 workflows, varios duplicados, ninguno corrió). | 🟡 |

## 🟠 Alta prioridad (antes de clientes reales)

| # | Qué falta | Estado |
|---|---|---|
| 6 | **Tests e2e** de los flujos críticos (login, sesión compartida, checkout, cerrar sesión desde «Dispositivos»). | 🟡 |
| 7 | **Checkout completo con datos reales**: la base de desarrollo tiene 1 organización y 0 órdenes. | ⏳ |
| 8 | **Prueba concurrente del checkout contra Postgres** (DT-IDEM-2). | ⏳ |
| 9 | **Tenant en `sass-back`** y SQL crudo del checkout / `reserveWithinTransaction` (filtran a mano). | ⏳ |
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

1. Variables de entorno de producción (#4) y primer `docker build` real (#3).
2. Ejecutar el CI y arreglar lo que salga (#5).
3. Un pedido de prueba de punta a punta y la prueba concurrente (#7, #8).
4. Pagos con idempotencia (#1, #2).
5. e2e mínimos (#6) y observabilidad (#11, #12).

## Registro de avance

_(Se completa a medida que se cierra cada punto.)_
