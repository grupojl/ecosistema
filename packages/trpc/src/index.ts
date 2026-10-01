/**
 * @real/trpc — contratos tRPC compartidos
 *
 * Exporta los tipos de AppRouter de cada back para que los fronts
 * tengan type-safety end-to-end sin importar directamente desde los backs.
 */

// ── Context compartido ────────────────────────────────────────────────────────
export type { TRPCContext }    from './server/context';
export       { createContext } from './server/context';

// ── Procedures base ───────────────────────────────────────────────────────────
export { createTRPCRouter, publicProcedure, protectedProcedure } from './server/trpc';

// ── SassAppRouter — realsass-sass-back ───────────────────────────────────────
import type { AppRouter as _SassAppRouter } from '../../../realsass-sass-back/src/trpc/app-router';
export type SassAppRouter = _SassAppRouter;

// ── EcommerceAppRouter — realsass-ecommerce-back ─────────────────────────────
import type { EcommerceAppRouter as _EcommerceAppRouter } from '../../../realsass-ecommerce-back/src/trpc/app-router';
export type EcommerceAppRouter = _EcommerceAppRouter;

// ── Markets ───────────────────────────────────────────────────────────────────
export type { MarketDTO, FulfillmentConfig } from '../../../realsass-sass-back/src/markets/domain/market.entity';
