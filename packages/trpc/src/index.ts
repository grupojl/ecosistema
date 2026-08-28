/**
 * @real/trpc — contratos tRPC compartidos
 *
 * Exporta los tipos de AppRouter de cada back para que los fronts
 * tengan type-safety end-to-end sin importar directamente desde los backs.
 *
 * Estrategia de tipos:
 *   - SassAppRouter        → tipo del router de realsass-sass-back
 *   - EcommerceAppRouter   → tipo del router de realsass-ecommerce-back
 *
 * Los fronts importan así:
 *   import type { SassAppRouter }      from '@real/trpc';
 *   import type { EcommerceAppRouter } from '@real/trpc';
 *
 * Por qué import type no genera dependencia circular:
 *   TypeScript erasa los type-only imports en el output JS.
 *   En runtime @real/trpc no importa nada de los backs.
 *   El Dockerfile de cada front copia packages/trpc/ + su propio back —
 *   el type-only import resuelve en compile time, no en runtime.
 */

// ── Context compartido ────────────────────────────────────────────────────────
export type { TRPCContext }    from './server/context';
export       { createContext } from './server/context';

// ── Procedures base ───────────────────────────────────────────────────────────
export { t, router, publicProcedure } from './server/trpc';

// ── SassAppRouter — realsass-sass-back ───────────────────────────────────────
// Consumido por: realsass-sass-front, realsass-dashboard-front
import type { AppRouter as _SassAppRouter } from '../../realsass-sass-back/src/trpc/app-router';
export type SassAppRouter = _SassAppRouter;

// ── EcommerceAppRouter — realsass-ecommerce-back ─────────────────────────────
// Consumido por: real-ecommerce-front
import type { EcommerceAppRouter as _EcommerceAppRouter } from '../../realsass-ecommerce-back/src/trpc/app-router';
export type EcommerceAppRouter = _EcommerceAppRouter;
