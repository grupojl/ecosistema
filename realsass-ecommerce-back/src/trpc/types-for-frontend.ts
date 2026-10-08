/**
 * types-for-frontend.ts — realsass-ecommerce-back
 * Consumido por @real/trpc (scripts/build.mjs lo emite como .d.ts en dist/contracts).
 */
import type { createEcommerceAppRouter } from './app-router';
export type EcommerceAppRouter = ReturnType<typeof createEcommerceAppRouter>;
