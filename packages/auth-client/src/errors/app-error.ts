/** AppErrorCode — codigos tipados de error del ecosistema. */
export type AppErrorCode =
  | 'AUTH'       // 401 — sin sesion o token expirado
  | 'FORBIDDEN'  // 403 — sin permisos
  | 'NOT_FOUND'  // 404
  | 'VALIDATION' // 400
  | 'CONFLICT'   // 409
  | 'RATE_LIMIT' // 429
  | 'SERVER'     // 5xx
  | 'NETWORK';   // fetch fallo sin respuesta

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
