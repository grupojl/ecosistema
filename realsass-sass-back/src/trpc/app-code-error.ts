/**
 * Código estable para la UI, independiente del texto del mensaje.
 * Se pasa como `cause` de un TRPCError y el errorFormatter lo expone en `error.data.appCode`.
 */
export type AppCode = 'REAUTH_REQUIRED' | 'QUOTA_EXCEEDED';

export class AppCodeError extends Error {
  constructor(public readonly appCode: AppCode, message: string) {
    super(message);
    this.name = 'AppCodeError';
  }
}
