---
name: test-integracion-tenant
description: Usar al escribir o ampliar tests de integración contra Postgres real, en especial aislamiento entre organizaciones (cross-tenant), stock bajo concurrencia o consultas de repositories Prisma, en sass-back o ecommerce-back.
---

# Test de integración multi-tenant (Postgres real)

**Por qué:** un fallo de aislamiento es una filtración de datos entre clientes (🔴 bloqueante). Los mocks no prueban SQL
ni concurrencia. Complementa ADR-024: los unitarios siguen sin base; estos usan una **base local efímera**, nunca compartida.

## Guardas

- Solo `TEST_DATABASE_URL` local; `test/integration-env.js` se niega a correr si no parece local (no sacar esa guarda).
- Nunca la `DATABASE_URL` del `.env` (apunta a Railway). Los tests **truncan** tablas.
- Migraciones aplicadas antes (skill `nueva-migracion`).

## Dónde vive todo

- Spec: `src/__tests__/integration/<tema>.int-spec.ts` (no matchea `*.spec.ts`: el `jest` unitario no lo corre).
- Config: `jest.integration.config.js` · setup: `test/integration-env.js` · script: `pnpm run test:int` (desde la carpeta del back,
  o `pnpm --filter <back> run test:int`). Excluido de `tsc` y de ESLint como el resto de specs.
- Molde: `realsass-ecommerce-back/src/__tests__/integration/tenant-isolation.int-spec.ts` y el de `realsass-sass-back`.

## Dónde está el aislamiento (probar donde vive)

| Capa | Ejemplo | Cómo se prueba |
|---|---|---|
| Repository con `organizationId` | catálogo, inventario, órdenes, webhooks | Llamar al repository con la org ajena |
| Service que verifica dueño (repo por `id`) | feature flags, themes | Instanciar el **service real** con el repository real; solo cache, auditoría y eventos son dobles |

## Pasos

1. Dos organizaciones `ORG_A`, `ORG_B` (en ecommerce son solo ids; en sass hay que crear `User` + `Organization`).
2. `beforeEach`: `TRUNCATE ... RESTART IDENTITY CASCADE` de **todas** las tablas tocadas (si falta una, un test contamina al siguiente) y sembrar en A.
3. Por cada operación: **B intenta** → espera `null`, `[]`, `false`, `NotFound` o `Forbidden` (según el contrato), y luego verificar **por A** que el dato quedó intacto.
4. **Control positivo**: la org dueña sí puede (si no, el test pasa por el motivo equivocado).
5. Casos de borde: lo global (`organizationId: null`) no lo edita nadie; mismo `handle`/`sku` en dos orgs sí, en la misma no.
6. Concurrencia: `Promise.all` de N operaciones sobre un recurso limitado y afirmar el conteo exacto de éxitos y el estado final
   (molde: 20 reservas de 1 unidad con stock 5 ⇒ exactamente 5 ganan, stock 0, reservado 5). Incluir rollback si falla a mitad de transacción.
7. **El test debe fallar sin el arreglo** (ADR-024): romper el código a propósito, ver rojo, restaurar.

## Ejecución

```bash
# Redis es opcional en local (los redis.int-spec se saltean con aviso) y obligatorio en el CI
docker run -d --name eco-test-redis -p 56379:6379 redis:7-alpine

TEST_DATABASE_URL=postgresql://test:test@localhost:55432/sass_test       TEST_REDIS_URL=redis://localhost:56379 pnpm --filter realsass-sass-back run test:int
TEST_DATABASE_URL=postgresql://test:test@localhost:55432/ecommerce_test  TEST_REDIS_URL=redis://localhost:56379 pnpm --filter realsass-ecommerce-back run test:int
```

`TEST_REDIS_URL` también se valida como local (`localhost`, `127.0.0.1` o un host `redis`). Usar un prefijo propio por proceso en las claves
y limpiarlas en `afterEach` (Redis no se trunca: nadie debe depender de que esté vacío). Para consultar el TTL real de una clave usar un
cliente `ioredis` aparte (import estático: jest corre en CommonJS y rechaza `import()` dinámico).

## Verificación final

- [ ] Verde con base limpia **y** al repetir (no depende del orden ni de datos previos)
- [ ] Rojo al quitar el filtro de organización o el chequeo del service (mutación manual)
- [ ] Tablas nuevas en el `TRUNCATE`
- [ ] `pnpm lint` y `pnpm typecheck` siguen en verde; el job `integration` del CI pasa

## Trampas conocidas

- `PrismaService` lee `DATABASE_URL` al construirse: la define el `setupFiles` antes de importar nada.
- El pool de `pg` queda abierto: por eso el script usa `--forceExit`.
- `PrismaInventoryRepository.reserve` **no es atómico** (lee-modifica-escribe); la reserva real es `reserveWithinTransaction`. No testear concurrencia sobre `reserve`.

## Caso de prueba real

2026-10-15: 9 tests en ecommerce-back y 7 en sass-back (catálogo, inventario, órdenes, flags, themes, webhooks, concurrencia de stock).
