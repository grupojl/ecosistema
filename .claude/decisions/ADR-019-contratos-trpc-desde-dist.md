# ADR-019: Contratos tRPC emitidos a `dist` — los fronts leen solo de `@real/trpc/dist`

**Fecha:** 2026-10-08
**Estado:** Aceptado · Docker de los fronts: **opción A implementada** (2026-10-08), verificada simulando los stages en un directorio limpio; **falta un `docker build` real** (ver "Pendiente")
**Complementa:** ADR-005 (REST → tRPC), `architecture/00-principios.md`, ADR-018 (dependencias)

## Contexto

`@real/trpc` exportaba `SassAppRouter` / `EcommerceAppRouter`, pero el contrato nunca llegó a ser
real:

- `src/index.ts` importaba `../../../realsass-*-back/dist/trpc/types-for-frontend`. Ese archivo no
  existe: el build de Nest (webpack) solo emite `main.js`.
- Para que los backs compilaran, `packages/trpc/dist/index.d.ts` se había reemplazado a mano por un
  stub con `SassAppRouter = any`. Con `any`, `createTRPCReact` no infiere nada y los fronts no tenían
  tipos contra los que compilar (el dashboard mostraba 150+ errores en cascada).
- Los backs declaraban `authProcedure`, `tenantProcedure`, `ownerProcedure`, `adminProcedure`,
  `ownerOnlyProcedure` y `customerProcedure` con `: any` (parche del commit "intento de fix para
  build" por el error TS2883). Eso borraba `input`, `output` y el tipo query/mutation de **todos** los
  procedures, aunque el `dist` fuera correcto.
- `next.config.mjs` del dashboard tenía `ignoreBuildErrors: true`, así que nada de lo anterior rompía
  el build.

## Decisión

1. **`pnpm --filter @real/trpc build` genera el contrato real.** `packages/trpc/scripts/build.mjs`:
   1. compila el núcleo (`markets`, `server/*`) a `dist/`;
   2. por cada back, emite solo declaraciones (`.d.ts`) desde `src/trpc/types-for-frontend.ts` con el
      **tsconfig de ese back** (cada back tiene alias `@/…` propios), mapeando `@real/auth-server` a su
      fuente, y las deja en `dist/contracts/<back>/`;
   3. reescribe los alias `@/…` de esos `.d.ts` a rutas relativas y copia el cliente Prisma generado
      (`src/generated/**/*.d.ts`);
   4. compila el paquete (`dist/index.d.ts`) que re-exporta `SassAppRouter`, `EcommerceAppRouter`,
      `MarketDTO`, `FulfillmentConfig`.
2. **Los fronts leen únicamente de `@real/trpc` (su `dist`).** Los tipos de dominio del front se
   *infieren* del contrato (`inferRouterInputs` / `inferRouterOutputs`), no se escriben a mano
   (`features/config/types.ts`, `features/store/types.ts` del dashboard).
3. **Los backs importan solo la hoja `@real/trpc/markets`** (`MarketDTO`). Es lo que evita el ciclo
   back → `@real/trpc` → back. `package.json` declara `exports` y `typesVersions` (ecommerce-back usa
   `moduleResolution: node10`, que ignora `exports`).
4. **Prohibido `any` en procedures.** Los builders se anotan con
   `TRPCProcedureBuilder<TrpcContext, object, <overrides con nombre>, …>`; los middlewares devuelven
   interfaces con nombre (`AuthedTrpcContext`, `TenantTrpcContext`, `OwnerTrpcContext`,
   `AdminTrpcContext`, …) para que el `.d.ts` no tenga que nombrar `ParsedQs`.
5. **Los fronts no ignoran errores de tipos.** `ignoreBuildErrors` se elimina del dashboard (y es el
   objetivo para los otros dos fronts, ver DT-SEO-07).
6. **Imports con alias `@/…` dentro de `packages/*` están prohibidos**: el consumidor los resuelve con
   su propio `tsconfig` (caso real: `@real/auth-client/src/http/api-fetch.ts`).

7. **Docker de los fronts: stage `contracts` (opción A).** Cada `Dockerfile` de front agrega un stage que
   instala el workspace con los dos backs, corre `prisma generate` y `pnpm --filter @real/trpc build`; el
   stage `build` del front copia **solo** `packages/trpc/dist` (`COPY --from=contracts`). El código de los
   backs no llega a la imagen del front. El contexto de build es la raíz del monorepo (Railway).
8. **`.dockerignore` en la raíz.** Docker no usa los `.dockerignore` de subcarpetas cuando el contexto es la
   raíz; sin este archivo los `COPY` arrastraban `node_modules`, `dist` y `src/generated` locales.
9. **`pnpm contracts`** (script raíz) es la única definición del orden `prisma generate` (ambos backs) →
   `@real/trpc build`. Todos los workflows lo ejecutan justo después de `pnpm install`.

### Orden de build (local y CI)

```
prisma generate (sass-back, ecommerce-back)
  → @real/trpc build            # lee las fuentes de ambos backs
    → sass-back / ecommerce-back typecheck + build
    → fronts typecheck + build  # leen packages/trpc/dist
```

## Alternativas descartadas

- **Mantener el stub `any` en `dist`** — compila, pero vacía el contrato: es exactamente el estado que
  ocultaba los errores.
- **Que los fronts importen `../realsass-*-back/src/...`** — rompe `00-principios.md` (el Dockerfile de un
  front no contiene el código de los backs).
- **Un solo `tsconfig` en `@real/trpc` para emitir ambos backs** — los alias `@/…` de cada back no
  coinciden; el contrato salía con módulos sin resolver (→ `any` silencioso).
- **Dependencia externa para empaquetar tipos (api-extractor, tsc-alias)** — ADR-018: una dependencia
  nueva por algo que resuelve un script de ~130 líneas sin runtime.

## Consecuencias

- Si un back cambia un procedure, los fronts dejan de compilar en vez de fallar en producción. Al
  sacar los `any` salieron bugs reales: los DTO de templates/webhooks pedían `organizationId` al
  cliente, y el router de temas de sass-back no exponía `create`/`remove` (`list` devolvía un solo
  tema y `update` solo activaba). Ya corregidos.
- `@real/trpc` **ya no es un paquete "sin build"**: `typecheck` y `build` ejecutan el script completo y
  requieren Prisma generado y las fuentes de ambos backs.
- Deuda consciente: `MarketDTO` está duplicado en `packages/trpc/src/markets.ts` y
  `realsass-sass-back/src/markets/domain/market.entity.ts` (la fuente de verdad del shape es la entidad).
- Los `.d.ts` de los services dejan `@nestjs/*`, `express`, `@prisma/client-runtime-utils` como imports
  de paquete: en un front sin esos tipos resuelven a `any` en posiciones que no forman parte de la
  salida de los routers.
- Los tipos de fecha del contrato dicen `Date` pero viajan como string (el cliente tRPC no usa
  transformer): usar siempre `new Date(valor)` en el front.

## Pendiente

- **`docker build` real de los tres fronts.** Se simuló cada stage (`contracts` → deps del front → `next build`)
  en un directorio limpio copiando solo lo que cada `COPY` copia, y los tres pasan; pero no hay Docker en la
  máquina donde se hizo, así que las imágenes no se construyeron ni se ejecutaron.
- Opción B (artefacto de CI) queda descartada por ahora: la A no requiere orden entre CI y deploy.
- El stage `contracts` está duplicado en los 3 Dockerfiles (Railway construye cada servicio aislado).
  Si se vuelve costoso: imagen base publicada o artefacto de CI.

## Referencias

- `packages/trpc/scripts/build.mjs`, `packages/trpc/src/{index,markets,router-types}.ts`
- `realsass-sass-back/src/trpc/trpc.ts`, `realsass-ecommerce-back/src/trpc/trpc.ts`
- `realsass-dashboard-front/lib/trpc/{client,ecommerce-client,provider,keys}.ts`
- `*/Dockerfile` de los 3 fronts (stage `contracts`), `.dockerignore`, `package.json` (script `contracts`)
