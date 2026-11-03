import { BadRequestException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { SecurityLogger } from './logger/security-logger';

describe('HttpExceptionFilter (respuesta uniforme de error)', () => {
  const run = (exception: unknown) => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ url: '/api/v1/x' }) }) };
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new HttpExceptionFilter().catch(exception, host as never);
    return { status: status.mock.calls[0]![0] as number, body: json.mock.calls[0]![0] as Record<string, unknown> };
  };
  afterEach(() => jest.restoreAllMocks());

  it('una HttpException conserva su status y su mensaje', () => {
    const { status, body } = run(new HttpException('no existe', 404));
    expect(status).toBe(404);
    expect(body).toMatchObject({ success: false, statusCode: 404, message: 'no existe', path: '/api/v1/x' });
    expect(typeof body['timestamp']).toBe('string');
  });

  it('los errores de validación (lista) se devuelven también como `errors`', () => {
    const { status, body } = run(new BadRequestException(['email inválido', 'edad inválida']));
    expect(status).toBe(400);
    expect(body['errors']).toEqual(['email inválido', 'edad inválida']);
  });

  it('un error cualquiera es 500 y NO filtra su stack al cliente', () => {
    const { status, body } = run(new Error('falla interna con datos sensibles'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('at ');
    expect(body['errors']).toBeUndefined();
  });

  it('algo que ni siquiera es un Error responde 500 con mensaje genérico', () => {
    const { status, body } = run('texto suelto');
    expect(status).toBe(500);
    expect(body['message']).toBe('Error interno');
  });

  it('un 5xx se registra con su stack; un 4xx no ensucia el log de errores', () => {
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const host = { switchToHttp: () => ({ getResponse: () => ({ status: () => ({ json: jest.fn() }) }), getRequest: () => ({ url: '/' }) }) };
    new HttpExceptionFilter().catch(new InternalServerErrorException('boom'), host as never);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();
    new HttpExceptionFilter().catch(new BadRequestException('x'), host as never);
    expect(spy).not.toHaveBeenCalled();
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
    const { req } = run({ 'x-request-id': 'trace-123' });
    expect(req.headers['x-request-id']).toBe('trace-123');
  });
});

describe('SecurityLogger (ecommerce-back)', () => {
  const warn = jest.fn();
  const logger = { warn } as unknown as Logger;
  beforeEach(() => warn.mockClear());

  it.each([
    ['tenantAccessDenied', { uid: 'u', organizationId: 'o', reason: 'r' }, 'auth.tenant_denied'],
    ['rateLimitHit', { path: '/x', limit: 5 }, 'rate_limit.hit'],
    ['suspiciousRequest', { reason: 'r', path: '/x' }, 'request.suspicious'],
  ] as const)('%s emite un evento de seguridad estructurado del servicio', (method, data, event) => {
    (SecurityLogger[method] as (l: Logger, d: unknown) => void)(logger, data);
    expect(warn.mock.calls[0]![0]).toMatchObject({ securityEvent: true, service: 'realsass-ecommerce-back', event, ...data });
  });
});
