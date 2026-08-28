/**
 * router-type.ts — realsass-dashboard-front
 *
 * Capa 5 completa: AppRouter tipado desde @real/trpc.
 * dashboard-front conecta con realsass-sass-back — mismo router que sass-front.
 *
 * Los collaboradores acceden a los mismos procedures que los owners,
 * con restricciones resueltas en el back por ownerProcedure vs tenantProcedure.
 * El tipo es el mismo — el back decide qué devuelve según el rol.
 */
import type { SassAppRouter } from '@real/trpc';

export type AppRouter = SassAppRouter;
