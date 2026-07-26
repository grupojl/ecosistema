export const AppErrorCode = { AUTH: 'AUTH', FORBIDDEN: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND', VALIDATION: 'VALIDATION', SERVER: 'SERVER', NETWORK: 'NETWORK' } as const
export type AppErrorCode = typeof AppErrorCode[keyof typeof AppErrorCode]
export interface AppError { code: AppErrorCode; message: string; status?: number; details?: unknown }
