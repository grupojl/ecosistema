// @real/trpc — implementación completa en S1/S2
export type { TRPCContext }     from './server/context'
export { createContext }        from './server/context'
export { createTRPCRouter, publicProcedure, protectedProcedure } from './server/trpc'
