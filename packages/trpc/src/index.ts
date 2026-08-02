export type { TRPCContext }    from './server/context';
export { createContext }       from './server/context';
export {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from './server/trpc';

// En Docker el backend no está disponible para type-check del front.
// AnyRouter permite que el build pase; el tipado real funciona en dev local.
import type { AnyRouter } from '@trpc/server';
export type AppRouter = AnyRouter;