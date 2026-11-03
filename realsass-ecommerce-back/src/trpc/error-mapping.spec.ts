/**
 * Las excepciones de Nest que lanzan los services deben llegar al front con su código real, no como
 * INTERNAL_SERVER_ERROR. Regresión hallada por el e2e del storefront: un producto inexistente respondía HTTP 500 en
 * lugar de 404 (y un conflicto de stock, 500 en lugar de 409).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { adminProcedure, customerProcedure, ownerOnlyProcedure, publicProcedure, router } from './trpc';
import { InsufficientStockError } from '@/inventory/errors/insufficient-stock.error';

const throwing = (error: Error) => async (): Promise<never> => {
  throw error;
};

const t = router({
  pub: publicProcedure.query(throwing(new NotFoundException('Producto "x" no encontrado'))),
  adm: adminProcedure.query(throwing(new ForbiddenException('no'))),
  own: ownerOnlyProcedure.query(throwing(new BadRequestException(['a inválido', 'b inválido']))),
  cus: customerProcedure.mutation(throwing(new InsufficientStockError('sku-1', 3, 1))),
  limit: publicProcedure.query(throwing(new HttpException('demasiado', 429))),
  teapot: publicProcedure.query(throwing(new HttpException('teapot', 418))),
  boom: publicProcedure.query(throwing(new Error('falla real'))),
});

const base = { req: { headers: {} }, userId: null, customerId: null, resolveCustomerId: async () => 'c1' };
const admin = { ...base, uid: 'u', organizationId: 'o', role: 'OWNER' as const };
const customer = { ...base, uid: null, organizationId: 'o', role: null };

const codeOf = (p: Promise<unknown>) => p.then(() => 'OK', (e: { code: string }) => e.code);

describe('mapeo de excepciones de Nest a códigos tRPC (ecommerce-back)', () => {
  it('NotFoundException → NOT_FOUND (el storefront responde 404)', async () => {
    const err = await t.createCaller(customer as never).pub().catch((e) => e);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Producto "x" no encontrado');
  });

  it('también dentro de los procedures de admin y de dueño', async () => {
    expect(await codeOf(t.createCaller(admin as never).adm())).toBe('FORBIDDEN');
    const own = await t.createCaller(admin as never).own().catch((e) => e);
    expect(own.code).toBe('BAD_REQUEST');
    expect(own.message).toBe('a inválido, b inválido'); // los mensajes de validación en lista se unen
  });

  it('sin stock (ConflictException) → CONFLICT, para que el checkout lo muestre como tal', async () => {
    expect(await codeOf(t.createCaller(customer as never).cus())).toBe('CONFLICT');
  });

  it('429 → TOO_MANY_REQUESTS; un status sin equivalente sigue siendo INTERNAL_SERVER_ERROR', async () => {
    expect(await codeOf(t.createCaller(customer as never).limit())).toBe('TOO_MANY_REQUESTS');
    expect(await codeOf(t.createCaller(customer as never).teapot())).toBe('INTERNAL_SERVER_ERROR');
  });

  it('un error que NO es de Nest se mantiene como INTERNAL_SERVER_ERROR (no se enmascara)', async () => {
    expect(await codeOf(t.createCaller(customer as never).boom())).toBe('INTERNAL_SERVER_ERROR');
  });

  it('InsufficientStockError es un ConflictException (el contrato que el mapeo necesita)', () => {
    expect(new InsufficientStockError('s', 2, 1)).toBeInstanceOf(ConflictException);
  });
});
