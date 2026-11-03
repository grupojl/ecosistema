import { BadRequestException, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { SecurityLogger } from './logger/security-logger';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ email: z.string().email(), age: z.coerce.number().int() }));

  it('devuelve el dato ya parseado (coerciones incluidas)', () => {
    expect(pipe.transform({ email: 'a@b.com', age: '30' })).toEqual({ email: 'a@b.com', age: 30 });
  });

  it('un dato inválido es 400 con el detalle de los campos', () => {
    let error: unknown;
    try {
      pipe.transform({ email: 'no', age: 'x' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((error as BadRequestException).getResponse())).toContain('email');
  });
});

describe('CorrelationIdMiddleware', () => {
  const run = (headers: Record<string, string> = {}) => {
    const req = { headers: { ...headers } };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();
    new CorrelationIdMiddleware().use(req as never, res as never, next);
    return { req, res, next };
  };

  it('genera un id si no viene y lo expone en la respuesta', () => {
    const { req, res, next } = run();
    expect(req.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.headers['x-request-id']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('respeta el id entrante (trazabilidad entre servicios)', () => {
    const { req, res } = run({ 'x-request-id': 'trace-123' });
    expect(req.headers['x-request-id']).toBe('trace-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'trace-123');
  });
});

describe('SecurityLogger', () => {
  const logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() } as unknown as Logger;
  beforeEach(() => jest.clearAllMocks());
  const logged = () => {
    const calls = [...(logger.warn as jest.Mock).mock.calls, ...(logger.error as jest.Mock).mock.calls, ...(logger.log as jest.Mock).mock.calls];
    return calls[0]![0] as Record<string, unknown>; // el logger recibe el evento como objeto estructurado
  };

  it('authFailure emite un evento de seguridad estructurado del servicio', () => {
    SecurityLogger.authFailure(logger, { reason: 'sin token', ip: '1.1.1.1' });
    expect(logged()).toMatchObject({ securityEvent: true, service: 'realsass-sass-back', event: 'auth.failure', reason: 'sin token' });
  });

  it('crossTenant, rateLimit y sessionRevoked emiten su evento', () => {
    SecurityLogger.crossTenantAttempt(logger, { uid: 'u', organizationId: 'o', reason: 'r' });
    expect(logged()).toMatchObject({ event: 'auth.cross_tenant', organizationId: 'o' });
    jest.clearAllMocks();
    SecurityLogger.rateLimitHit(logger, { path: '/x', limit: 10 });
    expect(logged()).toMatchObject({ event: 'rate_limit.hit', limit: 10 });
    jest.clearAllMocks();
    SecurityLogger.sessionRevoked(logger, { uid: 'u', reason: 'logout' });
    expect(logged()).toMatchObject({ event: 'auth.session_revoked', reason: 'logout' });
  });
});
