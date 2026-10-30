import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { InternalApiKeyGuard } from './internal-api-key.guard';

function ctxWith(headers: Record<string, string>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers, ip: '10.0.0.1' }) }) } as unknown as ExecutionContext;
}

function guardWith(expected: string | Error): InternalApiKeyGuard {
  const config = {
    getOrThrow: jest.fn(() => {
      if (expected instanceof Error) throw expected;
      return expected;
    }),
  } as unknown as ConfigService;
  return new InternalApiKeyGuard(config);
}

describe('InternalApiKeyGuard', () => {
  it('deja pasar con la clave correcta', () => {
    expect(guardWith('k1').canActivate(ctxWith({ 'x-internal-api-key': 'k1' }))).toBe(true);
  });

  it('401 sin header', () => {
    expect(() => guardWith('k1').canActivate(ctxWith({}))).toThrow(UnauthorizedException);
  });

  it('401 con clave incorrecta', () => {
    expect(() => guardWith('k1').canActivate(ctxWith({ 'x-internal-api-key': 'k2' }))).toThrow('Invalid internal API key');
  });

  it('no se deja engañar por el header de otro guard (x-api-key)', () => {
    expect(() => guardWith('k1').canActivate(ctxWith({ 'x-api-key': 'k1' }))).toThrow(UnauthorizedException);
  });

  it('si la configuración no tiene la clave, falla (no abre la puerta)', () => {
    expect(() => guardWith(new Error('INTERNAL_API_KEY no definida')).canActivate(ctxWith({ 'x-internal-api-key': 'k1' }))).toThrow();
  });
});
