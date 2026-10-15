---
name: nueva-migracion
description: Usar al cambiar prisma/schema.prisma de realsass-sass-back o realsass-ecommerce-back, al crear una migración Prisma, o al verificar que migraciones y schema no tengan deriva. NO usar para correr migraciones contra Railway ni contra ninguna base compartida.
---

# Nueva migración Prisma

**Por qué importa:** `entrypoint.sh` corre `prisma migrate deploy` al arrancar cada back (auditoría G3). Una
migración mala no falla en CI: **tumba el deploy en Railway**.

## Guardas (si alguna falla, parar y avisar)

1. **Nunca usar la `DATABASE_URL` del `.env`**: apunta a Railway. Toda orden lleva `DATABASE_URL=<url local>` explícita
   (`dotenv` no pisa una variable ya definida, así que la explícita gana).
2. La URL debe ser local: `localhost`, `127.0.0.1` o un contenedor. Si no, **rechazar**.
3. Sin Postgres local, pedirle al usuario que levante uno (no adivinar contraseñas):
   ```bash
   docker run -d --name eco-test-pg -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16-alpine
   docker exec eco-test-pg psql -U test -c "create database sass_test" -c "create database ecommerce_test"
   ```
4. Una migración ya aplicada **no se edita**: se crea otra. `migrate reset` solo en base local.

## Pasos

1. Identificar el back y trabajar dentro de su carpeta (`realsass-sass-back` o `realsass-ecommerce-back`).
2. Editar `prisma/schema.prisma`. Reglas:
   - Todo modelo con datos de negocio lleva `organizationId` y `@@index([organizationId])` (ver `checklists/backend-capa-6-multitenant.md`).
   - **Primero aditivo**: columnas nuevas nullable o con `@default`. Borrar o renombrar columnas, o `ALTER TYPE`,
     requieren aprobación explícita del usuario y un plan de datos (expandir → migrar → contraer).
3. Generar: `DATABASE_URL=<local> pnpm exec prisma migrate dev --name <accion_en_snake_case>`
4. **Leer el `migration.sql` generado.** Buscar `DROP`, `ALTER COLUMN ... NOT NULL` sin default, cambios de tipo. Mostrárselos al usuario.
5. Verificar desde cero (base nueva, no la que ya tiene la migración):
   ```bash
   DATABASE_URL=<local-nueva> pnpm exec prisma migrate deploy
   DATABASE_URL=<local-nueva> pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
   ```
   Debe decir `No difference detected`.
6. Desde la raíz: `pnpm contracts` (orden fijo: `prisma generate` → `@real/trpc build`), `pnpm typecheck`.
7. Si hay datos nuevos con tenant, agregar el caso a los tests de integración (skill `test-integracion-tenant`) y sumar la tabla al `TRUNCATE` del `beforeEach`.

## Verificación final

- [ ] `migrate deploy` limpio y `migrate diff` sin diferencias (en base nueva)
- [ ] `pnpm contracts` y `pnpm typecheck` en verde
- [ ] `pnpm test:int` en verde (con `TEST_DATABASE_URL`)
- [ ] El SQL fue revisado y las operaciones destructivas, aprobadas

## Caso de prueba real

2026-10-15: se aplicaron las migraciones de ambos backs sobre Postgres 16 limpio y `migrate diff` dio cero diferencias
(WEL-01). Esas mismas órdenes son este procedimiento. El job `integration` de `ci.yml` las repite en cada PR.

## Mantenimiento

Depende de: ADR-019 (orden de contratos), ADR-022, `scripts/audit/deploy.sh` (G3). Revisar si cambia Prisma de major.
