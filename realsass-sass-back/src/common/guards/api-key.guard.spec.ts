import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

function ctxWith(headers: Record<string, string>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const original = process.env['INTERNAL_API_KEY'];
  const guard = new ApiKeyGuard();

  afterEach(() => {
    if (original === undefined) delete process.env['INTERNAL_API_KEY'];
    else process.env['INTERNAL_API_KEY'] = original;
  });

  it('deja pasar con la clave correcta', () => {
    process.env['INTERNAL_API_KEY'] = 'clave-interna';
    expect(guard.canActivate(ctxWith({ 'x-api-key': 'clave-interna' }))).toBe(true);
  });

  it('rechaza sin header', () => {
    process.env['INTERNAL_API_KEY'] = 'clave-interna';
    expect(() => guard.canActivate(ctxWith({}))).toThrow(UnauthorizedException);
  });

  it('rechaza una clave incorrecta', () => {
    process.env['INTERNAL_API_KEY'] = 'clave-interna';
    expect(() => guard.canActivate(ctxWith({ 'x-api-key': 'otra' }))).toThrow('API Key invalida');
  });

  it('falla cerrado si el servidor no tiene INTERNAL_API_KEY (nunca acepta cualquier clave)', () => {
    delete process.env['INTERNAL_API_KEY'];
    expect(() => guard.canActivate(ctxWith({ 'x-api-key': 'cualquiera' }))).toThrow('no configurada');
    expect(() => guard.canActivate(ctxWith({ 'x-api-key': '' }))).toThrow(UnauthorizedException);
  });

  it('no acepta una clave vacía aunque la del servidor también lo esté', () => {
    process.env['INTERNAL_API_KEY'] = '';
    expect(() => guard.canActivate(ctxWith({ 'x-api-key': '' }))).toThrow(UnauthorizedException);
  });
});
