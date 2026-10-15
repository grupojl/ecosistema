import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard';

const ctx = (headers: Record<string, string>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers, ip: '1.2.3.4' }) }) }) as unknown as ExecutionContext;

describe('ApiKeyGuard (x-api-key)', () => {
  const guard = new ApiKeyGuard();
  let previous: string | undefined;
  beforeEach(() => { previous = process.env['INTERNAL_API_KEY']; });
  afterEach(() => { if (previous === undefined) delete process.env['INTERNAL_API_KEY']; else process.env['INTERNAL_API_KEY'] = previous; });

  it('acepta la clave correcta', () => {
    process.env['INTERNAL_API_KEY'] = 'k-correcta';
    expect(guard.canActivate(ctx({ 'x-api-key': 'k-correcta' }))).toBe(true);
  });

  it('rechaza una clave incorrecta, vacía o ausente', () => {
    process.env['INTERNAL_API_KEY'] = 'k-correcta';
    expect(() => guard.canActivate(ctx({ 'x-api-key': 'otra' }))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx({ 'x-api-key': '' }))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
  });

  it('falla cerrado: sin INTERNAL_API_KEY configurada nada pasa (ni siquiera una clave vacía)', () => {
    delete process.env['INTERNAL_API_KEY'];
    expect(() => guard.canActivate(ctx({ 'x-api-key': '' }))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx({ 'x-api-key': 'cualquiera' }))).toThrow(UnauthorizedException);
  });

  it('rotación: acepta la clave nueva y la vieja mientras ambas estén configuradas', () => {
    process.env['INTERNAL_API_KEY'] = 'nueva,vieja';
    expect(guard.canActivate(ctx({ 'x-api-key': 'nueva' }))).toBe(true);
    expect(guard.canActivate(ctx({ 'x-api-key': 'vieja' }))).toBe(true);
    process.env['INTERNAL_API_KEY'] = 'nueva';
    expect(() => guard.canActivate(ctx({ 'x-api-key': 'vieja' }))).toThrow(UnauthorizedException);
  });
});

describe('InternalApiKeyGuard (x-internal-api-key)', () => {
  const guardWith = (configured: string) =>
    new InternalApiKeyGuard({ getOrThrow: () => configured } as unknown as ConfigService);

  it('con una clave por servicio: autoriza al que corresponde y deja SU nombre en la request (auditoría)', () => {
    const guard = guardWith('ecommerce=k-ecommerce-0123456789abcdef,superadmin=k-superadmin-0123456789abcdef');
    const req = { headers: { 'x-internal-api-key': 'k-superadmin-0123456789abcdef' }, ip: '1.2.3.4', method: 'GET', path: '/internal/x' };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    expect((req as { internalCaller?: string }).internalCaller).toBe('superadmin');
  });

  it('revocar a un servicio (quitar su entrada) lo deja afuera sin afectar al resto', () => {
    const sinSuperadmin = guardWith('ecommerce=k-ecommerce-0123456789abcdef');
    expect(() => sinSuperadmin.canActivate(ctx({ 'x-internal-api-key': 'k-superadmin-0123456789abcdef' }))).toThrow(UnauthorizedException);
    expect(sinSuperadmin.canActivate(ctx({ 'x-internal-api-key': 'k-ecommerce-0123456789abcdef' }))).toBe(true);
  });

  it('acepta cualquiera de las claves configuradas y rechaza el resto', () => {
    const guard = guardWith('nueva,vieja');
    expect(guard.canActivate(ctx({ 'x-internal-api-key': 'nueva' }))).toBe(true);
    expect(guard.canActivate(ctx({ 'x-internal-api-key': 'vieja' }))).toBe(true);
    expect(() => guard.canActivate(ctx({ 'x-internal-api-key': 'robada' }))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
  });
});
