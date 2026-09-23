import { NotFoundException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { rethrowAsTrpcStoreError } from './store.trpc-errors';

function codeOf(err: unknown): string {
  try {
    rethrowAsTrpcStoreError(err);
  } catch (e) {
    if (e instanceof TRPCError) return e.code;
  }
  throw new Error('rethrowAsTrpcStoreError no lanzó un TRPCError');
}

describe('rethrowAsTrpcStoreError', () => {
  it('NotFound → NOT_FOUND',                      () => expect(codeOf(new NotFoundException())).toBe('NOT_FOUND'));
  it('ServiceUnavailable → SERVICE_UNAVAILABLE',   () => expect(codeOf(new ServiceUnavailableException())).toBe('SERVICE_UNAVAILABLE'));
  it('otro HttpException → INTERNAL_SERVER_ERROR', () => expect(codeOf(new BadRequestException())).toBe('INTERNAL_SERVER_ERROR'));
  it('Error genérico → INTERNAL_SERVER_ERROR',     () => expect(codeOf(new Error('boom'))).toBe('INTERNAL_SERVER_ERROR'));
  it('TRPCError se propaga intacto',               () => expect(codeOf(new TRPCError({ code: 'FORBIDDEN' }))).toBe('FORBIDDEN'));
});
