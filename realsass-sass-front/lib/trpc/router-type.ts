/**
 * router-type.ts — realsass-sass-front
 *
 * Capa 5 completa: AppRouter tipado desde @real/trpc.
 * Los procedures de realsass-sass-back tienen type-safety end-to-end.
 *
 * Cuando este archivo importa SassAppRouter, TypeScript conoce exactamente
 * qué procedures existen, qué inputs aceptan y qué outputs retornan.
 * Un procedure renombrado o con input cambiado rompe el build de este front
 * antes de llegar a producción — ese es el contrato que Capa 5 garantiza.
 */
import type { SassAppRouter } from '@real/trpc';

export type AppRouter = SassAppRouter;
