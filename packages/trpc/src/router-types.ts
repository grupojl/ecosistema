/**
 * Tipos de los routers de cada back, generados por scripts/build.mjs.
 *
 * `dist/contracts/<back>/` contiene las declaraciones (.d.ts) que cada back
 * emite con SU tsconfig (alias @/ propios) — los fronts leen solo de acá,
 * nunca del código fuente de un back. Este archivo no compila hasta que
 * corra `pnpm --filter @real/trpc build`.
 */
export type { AppRouter as SassAppRouter }
  from '../dist/contracts/sass-back/realsass-sass-back/src/trpc/types-for-frontend';

export type { EcommerceAppRouter }
  from '../dist/contracts/ecommerce-back/realsass-ecommerce-back/src/trpc/types-for-frontend';
