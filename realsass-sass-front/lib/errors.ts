/**
 * Tipos de error estandarizados para toda la app.
 * Reemplaza los "catch (e: any)" con tipos concretos.
 */

export interface ApiError {
  statusCode: number
  error:      string
  message:    string | string[]
  path?:      string
  timestamp?: string
}

export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'message' in err
  )
}

/**
 * Extrae un mensaje legible de cualquier error.
 * Prioriza el mensaje del backend; fallback a message genérico.
 */
export function getErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (isApiError(err)) {
    const msg = err.message
    return Array.isArray(msg) ? msg[0] : msg
  }
  if (err instanceof Error) return err.message
  return fallback
}

/**
 * Errores de dominio con códigos semánticos para la UI.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: 'NETWORK' | 'AUTH' | 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION' | 'UNKNOWN',
    public readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
