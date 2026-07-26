export interface TRPCContext { userId?: string; organizationId?: string; user?: unknown }
export function createContext(): TRPCContext { return {} }
