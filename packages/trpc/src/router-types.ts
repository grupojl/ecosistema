/**
 * Tipo del router del back (sass-back, que es también el back de Welver), generados por scripts/build.mjs.
 *
 * `dist/contracts/<back>/` contiene las declaraciones (.d.ts) que cada back
 * emite con SU tsconfig (alias @/ propios) — los fronts leen solo de acá,
 * nunca del código fuente de un back. Este archivo no compila hasta que
 * corra `pnpm --filter @real/trpc build`.
 */
export type { AppRouter as SassAppRouter }
  from '../dist/contracts/sass-back/realsass-sass-back/src/trpc/types-for-frontend';
