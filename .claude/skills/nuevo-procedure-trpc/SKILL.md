---
name: nuevo-procedure-trpc
description: Usar al crear o modificar un procedure o router tRPC en realsass-sass-back o realsass-ecommerce-back (query o mutation), o al cambiar el contrato que consumen los fronts. Aplica ADR-005, ADR-019, ADR-022 y ADR-023.
---

# Nuevo procedure tRPC

**Principio:** todo lo interno va por tRPC; REST solo para API pública, webhooks inbound, `POST/DELETE /auth/session` y `GET /health`.
Un endpoint REST interno nuevo es un bug de arquitectura.

## 1. Elegir el tipo de procedure

| Back | Procedure | Contexto que da |
|---|---|---|
| sass-back | `publicProcedure` | nada (solo datos públicos) |
| sass-back | `authProcedure` | usuario autenticado |
| sass-back | `tenantProcedure` | + `ctx.organizationId`, `ctx.uid` (miembro de la org) |
| sass-back | `ownerProcedure` | solo el dueño de la org |
| ecommerce-back | `publicProcedure` / `customerProcedure` | storefront; `customerProcedure` exige la cookie firmada |
| ecommerce-back | `adminProcedure` / `ownerOnlyProcedure` | panel del dueño / solo dueño |

Ante la duda, el más restrictivo: **fallar cerrado**.

## 2. Reglas del input y del contexto

- **Input con Zod inline** junto al router. Nada de class-validator ni DTOs de clase.
- **`organizationId` sale de `ctx`, nunca del input.** Un `organizationId` en el input es una invitación a leer otra organización.
- **`customerId` sale de la cookie HttpOnly `store_session`** (ADR-023), jamás de un header ni del input. El carrito se ata a ese id (`getOwnedCart`).
- Prohibido `any`, `as any`, `as unknown as`. Los builders ya vienen con contexto nombrado (evita TS2883); no re-anotar con `any`.
- Los errores salen como excepciones de Nest (`NotFoundException`, `ConflictException`…) y `mapNestErrors` las traduce; no devolver 500 por un caso de negocio.

## 3. Pasos

1. La lógica va en el **service**, no en el router (el router solo valida, toma `ctx` y delega).
2. Router: `src/trpc/routers/<modulo>.router.ts` con `create<Modulo>Router(service)`, siguiendo `config-flags.router.ts`.
3. Registrarlo: agregar la dependencia en `AppRouterDeps` y la clave en `createAppRouter` (`src/trpc/app-router.ts`) y cablear el service en `TrpcModule`.
4. Tests: spec del service con repository fake + caso de tenant en integración (skill `test-integracion-tenant`) + verificar el 401/403 del procedure.
5. Regenerar contrato: `pnpm contracts` (`prisma generate` → `@real/trpc build`).
6. Los fronts leen **solo `dist` de `@real/trpc`** y derivan tipos con `inferRouterOutputs`. Si un front deja de compilar, el contrato cambió: arreglar el consumidor en el mismo cambio.
7. Documentar el procedure en `contracts/trpc-routers.md` si es público o cambia una forma existente.

## Verificación final

- [ ] `pnpm contracts && pnpm typecheck` (incluye los fronts)
- [ ] `pnpm test:cov` del back tocado; `pnpm lint`
- [ ] `bash scripts/audit/run.sh contratos-tipado` y `seguridad`
- [ ] Un test demuestra que sin sesión/rol correcto el procedure responde 401/403

## Mantenimiento

Depende de ADR-005, ADR-019, ADR-022, ADR-023 y `contracts/trpc-routers.md`. Si cambian los nombres de los procedures base, actualizar la tabla.
