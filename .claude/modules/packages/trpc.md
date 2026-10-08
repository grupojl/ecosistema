# Package: @real/trpc (el contrato entre back y front)

## ¿Qué hace en palabras simples?

Es el "acuerdo por escrito" entre los motores y las pantallas. Define exactamente
qué puede pedir cada pantalla a cada motor, qué datos tiene que enviar, y qué
datos va a recibir. Si alguien cambia algo en el motor sin actualizar el acuerdo,
el sistema avisa con un error antes de llegar a producción.

## ¿Qué problemas resuelve?

- "El front llamó a un endpoint que ya no existe" → error en tiempo de compilación, no en producción
- "Cambié el nombre de un campo en el back, ¿dónde se usa en el front?" → TypeScript lo marca automáticamente
- "¿Qué puede hacer cada pantalla?" → está escrito en el tipo SassAppRouter / EcommerceAppRouter

## ¿Por qué existe como package separado?

Porque tanto los motores como las pantallas necesitan saber cuál es el contrato.
Es el puente tipado que garantiza que si el back cambia, el front lo sabe.

## Contenido

- **SassAppRouter**: todos los procedimientos que expone sass-back (auth, organizaciones,
  colaboradores, configuración, etc.)
- **EcommerceAppRouter**: todos los procedimientos que expone ecommerce-back (catálogo,
  inventario, órdenes, carrito, cliente)

## Cómo se genera (ADR-019)

`pnpm --filter @real/trpc build` corre `scripts/build.mjs`:

1. compila el núcleo (`markets`, `server/*`) a `dist/`;
2. emite los `.d.ts` de cada back (con el tsconfig de ese back) a `dist/contracts/<back>/`, reescribe los
   alias `@/…` a relativos y copia el cliente Prisma generado;
3. compila el paquete: `dist/index.d.ts` re-exporta `SassAppRouter`, `EcommerceAppRouter`,
   `MarketDTO`, `FulfillmentConfig`.

Requiere `prisma generate` en ambos backs. `typecheck` y `build` son lo mismo.

## Cómo se consume

- **Fronts:** `import type { SassAppRouter } from '@real/trpc'`. Los tipos de dominio se infieren con
  `inferRouterInputs` / `inferRouterOutputs`; no se escriben a mano.
- **Backs:** solo `import type { MarketDTO } from '@real/trpc/markets'` (hoja sin dependencias; evita el
  ciclo con los routers).

## Estado actual (2026-10-08)

✅ Contrato real y sin `any` en los procedures: `SassAppRouter` y `EcommerceAppRouter` se infieren de los
routers de los backs. Verificado con los **tres** fronts (typecheck + build, sin `ignoreBuildErrors`).
✅ `pnpm contracts` (raíz) lo construye; todos los workflows lo ejecutan tras `pnpm install`.
✅ Docker: cada front tiene un stage `contracts` (ADR-019). Simulado en directorio limpio; sin `docker build` real aún.
