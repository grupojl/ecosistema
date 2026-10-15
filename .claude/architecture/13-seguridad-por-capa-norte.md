# 13 — Seguridad por capa: qué es un 10/10 y cómo se verifica

> **Contrato.** Define el criterio de un 10/10 en cada capa. El *estado* de cada capa se mantiene en
> `roadmap/deuda-tecnica.md` (es dinámico); acá solo está el criterio y la columna "falta" que se actualiza al cerrar
> un pendiente. Relacionado: ADR-023 (modelo de seguridad), ADR-027 (Row Level Security).

## Principio

**Una capa tiene 10/10 cuando su garantía no depende de que alguien se acuerde de algo, y un test o una auditoría falla
si alguien la rompe.** Una garantía que solo está escrita es un 7 como mucho.

Cada capa se defiende sola: si la anterior falla, esta contiene el daño. Por eso hay dos capas de aislamiento entre
organizaciones (aplicación y base) y dos de límite de abuso (borde y servicio).

## Frontend

| Capa | Criterio de 10/10 | Cómo se verifica | Falta hoy |
|---|---|---|---|
| **F1 Presentación** | Sin HTML crudo del tenant; JSON-LD serializado contra XSS; **CSP con nonces sin `unsafe-inline`** | Auditoría C6; test que lee los headers del build | CSP con nonces (ADR-026): necesita un navegador y decidir el costo en ISR del storefront |
| **F2–F3 Estado y datos** | Nada de credenciales en `localStorage`; ningún fetch propio | Auditoría C3; ESLint `no-restricted-globals: fetch` + allowlist | — |
| **F4 Server Components** | Un Server Component no usa hooks de cliente | `app/server-boundary.spec.ts` (guard estático) | — |
| **F5 Auth de cliente** | Sesión solo en cookie HttpOnly firmada; cuentas recurrentes con verificación de email | Auditoría S1; tests de sesión | Cuentas recurrentes (ADR-025): requiere proveedor de email y decisión de producto |
| **F6 Edge** | Redirects y negociación de idioma sin datos sensibles | `lib/i18n/negotiate.spec.ts` (la lógica); `proxy.ts` se verificó a mano (307 con `Vary`/`Cache-Control`) | Test automático de `proxy.ts` |

## Contrato

| Capa | Criterio de 10/10 | Cómo se verifica | Falta hoy |
|---|---|---|---|
| **C `@real/trpc`** | Sin `any`; los fronts leen solo el `dist`; un cambio de procedure que rompe un front falla el build | `pnpm contracts` + typecheck de los 3 fronts en CI | — |

## Backend

| Capa | Criterio de 10/10 | Cómo se verifica | Falta hoy |
|---|---|---|---|
| **B0 Borde HTTP** | Helmet, CORS cerrado, `trust proxy`, rate limit **compartido entre réplicas** y que **nunca queda abierto** si el store falla | Auditorías C2/C7/S2/S4; `rate-limit-instances.int-spec` (dos instancias, Redis real); tests del middleware con store caído | Rate limit específico y progresivo por cuenta en login/registro |
| **B1 Auth y tenant** | Identidad solo de credenciales verificadas; secretos obligatorios al arrancar; claves rotables y comparadas en tiempo constante | Auditorías S1/S3/S5; matrices `authorization.spec` con los routers reales; mutación del guard (36 tests fallan si se debilita) | — |
| **B2 Router tRPC** | **Toda mutación sin sesión está en una lista explícita**; la organización sale del contexto, nunca del input; el servicio-a-servicio exige clave | Auditoría **S10** (`public-mutations.allowlist`); `authorization.spec`; `markets.integration.spec` | — |
| **B3 Service** | Idempotencia en lo que cobra o reserva; reglas de negocio con errores tipados | `checkout-idempotency.int-spec` (20 checkouts del mismo carrito => 1 orden, stock reservado una vez) | Pagos reales: idempotencia con proveedor, confirmación por webhook firmado, transiciones de estado ya validadas (`assertValidOrderTransition`) |
| **B4 Domain** | Reglas puras, errores tipados traducidos a 404/409/422 | Specs de dominio | — |
| **B5 Repository** | Toda consulta con `organizationId`; operaciones de stock **atómicas** (UPDATE condicional) | Auditoría C4; `tenant-isolation.int-spec`; concurrencia sobre `reserve`/`release` | — |
| **B6 Persistencia** | **Row Level Security** forzado con rol sin `BYPASSRLS`; default-deny; servicio que no arranca con un rol que saltea RLS | Auditorías **S8/S9**; `rls.int-spec` en cada back (con mutación: 12/14 fallan con el rol administrador) | **Fase 2 en sass-back** (auth, colaboradores, tablas con filas globales); probar el despliegue real en Railway; medir la latencia del `set_config` |

## Transversales

| Aspecto | Criterio de 10/10 | Cómo se verifica | Falta hoy |
|---|---|---|---|
| **Multi-tenant** | Dos capas independientes: aplicación (`where`) y base (RLS) | Ver B5 y B6 | Fase 2 de RLS |
| **Webhooks** | Anti-SSRF en cada entrega, firma HMAC con timestamp, secreto cifrado y fuera de Redis, reintentos acotados | `webhook-delivery.processor.spec`; `webhook-delivery.int-spec` (BullMQ + Redis + Postgres reales); mutación de la firma | Firma de webhooks *entrantes* (pagos): no existe todavía |
| **Redis** | Contadores atómicos; compartidos entre réplicas; una falla degrada, no abre | `redis.int-spec`; `rate-limit-instances.int-spec` | — |
| **Secretos y suministro** | Sin secretos en el repo; `pnpm audit` en 0; dependencias con dueño | Auditoría C5 + gitleaks + pre-commit; `pnpm audit` | Rotación probada en un entorno real |
| **Cadena de entrega** | El CI exige todo; imágenes que construyen y arrancan | `ci.yml`; `docker build` de los 5 servicios | **El CI nunca corrió en GitHub**; los contenedores no se probaron arrancando; no hay branch protection |
| **Operación** | Backups, alertas y runbook | Skill `runbook-incidente` | Backups y alertas sin definir |

## Reglas duras que salen de esto

1. **Una mutación tRPC sin sesión es una decisión de seguridad**: se agrega a `scripts/audit/public-mutations.allowlist`
   con su motivo, o no se mergea (S10).
2. **`runAsSystem()` solo desde los archivos de la lista de S8.** Ampliarla exige actualizar el ADR-027.
3. **Código que corre fuera de una petición (jobs, listeners, controllers internos) abre su alcance de tenant a
   propósito** con `runInTenant`; sin alcance la base devuelve vacío.
4. **`tenant-context.ts` y `tenant-aware-pool.ts` son idénticos en ambos backs** (S9). Se cambian en los dos.
5. **El servicio se conecta con `eco_app`, nunca con un superusuario, en producción.**
6. **Un `UPDATE`/`DELETE` por id de un recurso del tenant verifica pertenencia** (el id de otra organización responde como
   uno inexistente).
7. **Un test de seguridad no cuenta hasta que se lo vio fallar**: toda regla nueva se prueba con una mutación (romper el
   código a propósito y comprobar que el test o la auditoría lo detecta).
