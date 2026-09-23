/**
 * Traduce excepciones HTTP de Nest a códigos tRPC.
 *
 * Sin esto, tRPC convierte CUALQUIER excepción no-TRPCError en
 * INTERNAL_SERVER_ERROR y el storefront no puede distinguir
 * "la tienda no existe" (404 → desindexar) de "sass-back caído"
 * (503 → Google reintenta y conserva la indexación).
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { TRPCError } from '@trpc/server';

export function rethrowAsTrpcStoreError(err: unknown): never {
  if (err instanceof TRPCError) throw err;

  if (err instanceof HttpException) {
    const status = err.getStatus();
    if (status === HttpStatus.NOT_FOUND) {
      throw new TRPCError({ code: 'NOT_FOUND', message: err.message, cause: err });
    }
    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      throw new TRPCError({ code: 'SERVICE_UNAVAILABLE', message: err.message, cause: err });
    }
  }

  throw new TRPCError({
    code:    'INTERNAL_SERVER_ERROR',
    message: 'Error inesperado resolviendo la tienda',
    cause:   err instanceof Error ? err : undefined,
  });
}
