// @real/trpc — contratos tRPC del ecosistema
export type { TRPCContext }     from './server/context';
export { createContext }        from './server/context';
export {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from './server/trpc';

// AppRouter — tipo real del router, sin DTOs NestJS en la cadena.
export type { AppRouter } from '../../../realsass-sass-back/src/trpc/app-router';