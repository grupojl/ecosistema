# ADR-030 — Norte de tipos: sin `any` ni aserciones inseguras

- **Estado:** aceptada
- **Fecha:** 2026-11-03
- **Relacionada:** ADR-019 (contratos tRPC sin `any`)

## Contexto

ADR-019 prohíbe `any` en los procedures, pero el código de apoyo acumuló `as any`, `as unknown as` y `as Tipo` sobre datos
que el compilador no puede verificar (columnas Json de Prisma, headers/cookies de Express, respuestas de otros servicios,
caché de Redis). Un cast no valida: miente. Al quitarlos apareció un bug real (el formulario de organización borraba la
descripción al guardar porque leía campos con `as any`).

## Decisión

1. **Cero** `any`, `as any`, `as never`, `as unknown as` y `@ts-ignore` en código de producción. Lo comprueba
   `scripts/check-type-safety.mjs --check` en CI (`ci-global.yml`).
2. **Cada borde tiene su mecanismo**, no un cast:
   | Borde | Mecanismo |
   |---|---|
   | Escribir objeto en columna Json | `toJsonObject()` (Zod `z.json()`) |
   | Leer columna Json / job de BullMQ / respuesta HTTP externa | esquema Zod (`parse`/`safeParse`) |
   | Header / cookie / mensaje de error de Express | `headerOf`, `cookieOf`, `bearerOf`, `messageOf`, `errorMessage` de `@real/auth-server` |
   | Fila Prisma → dominio | función mapeadora (`toOrderRecord`, `MarketEntity.fromPrisma`) |
   | Enums de Prisma | se usan los tipos generados, sin recasteo |
   | Globales del navegador | `declare global { interface Window … }` / type guards |
   | Datos de tabla literal | `as const satisfies T` |
3. **`as Tipo` residual** solo se admite con marcador en la misma línea o la anterior: `// @real/cast:<tipo> motivo`
   (`sdk`, `cache`, `external`, `dom`). Sin marcador, cuenta contra la línea base `scripts/type-safety.baseline.json`,
   que **solo puede bajar** (ratchet).
4. En ecommerce-back los guards/servicios importan las hojas `@/http/request` y `@/types/tenant-context`, no el barril
   `@real/auth-server` (arrastra firebase-admin y rompe Jest).

## Consecuencias

- Una respuesta con forma inesperada ahora falla en el borde con un error claro, no más adentro.
- Quedan casts `as Tipo` sin marcar en los fronts (eventos del DOM, etc.); la línea base los congela y se reducen por
  tandas. Ver `roadmap/deuda-tecnica.md`.
