import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard';
import { InternalOrganizationsController } from '@/internal/internal-organizations.controller';

const LARGA_A = 'a'.repeat(32);
const LARGA_B = 'b'.repeat(32);

describe('InternalApiKeyGuard (/internal/* — solo superadmin y servicios)', () => {
  const build = (configured: string | undefined) => {
    const config = { getOrThrow: jest.fn((name: string) => {
      if (configured === undefined) throw new Error(`Config key "${name}" does not exist`);
      return configured;
    }) };
    return new InternalApiKeyGuard(config as unknown as ConfigService);
  };

  const ctxWith = (headers: Record<string, string>) => {
    const req: Record<string, unknown> = { headers, ip: '9.9.9.9', method: 'POST', path: '/internal/organizations/x/suspend' };
    return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext };
  };

  it('sin header => 401', () => {
    const { ctx } = ctxWith({});

    expect(() => build(LARGA_A).canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('clave incorrecta (incluso casi igual) => 401', () => {
    expect(() => build(LARGA_A).canActivate(ctxWith({ 'x-internal-api-key': LARGA_B }).ctx)).toThrow(UnauthorizedException);
    expect(() => build(LARGA_A).canActivate(ctxWith({ 'x-internal-api-key': LARGA_A + 'x' }).ctx)).toThrow(UnauthorizedException);
    expect(() => build(LARGA_A).canActivate(ctxWith({ 'x-internal-api-key': LARGA_A.slice(0, -1) }).ctx)).toThrow(UnauthorizedException);
  });

  it('un header vacío NO coincide con una variable vacía (falla cerrado)', () => {
    expect(() => build('').canActivate(ctxWith({ 'x-internal-api-key': '' }).ctx)).toThrow(UnauthorizedException);
  });

  it('INTERNAL_API_KEY sin definir => el guard explota (no se abre): getOrThrow', () => {
    expect(() => build(undefined).canActivate(ctxWith({ 'x-internal-api-key': LARGA_A }).ctx)).toThrow(/does not exist/);
  });

  it('clave correcta => pasa y queda registrado quién llamó ("default" si la clave no tiene nombre)', () => {
    const { req, ctx } = ctxWith({ 'x-internal-api-key': LARGA_A });

    expect(build(LARGA_A).canActivate(ctx)).toBe(true);
    expect(req['internalCaller']).toBe('default');
  });

  it('rotación sin caída: acepta la nueva y la vieja', () => {
    const guard = build(`${LARGA_B},${LARGA_A}`);

    expect(guard.canActivate(ctxWith({ 'x-internal-api-key': LARGA_A }).ctx)).toBe(true);
    expect(guard.canActivate(ctxWith({ 'x-internal-api-key': LARGA_B }).ctx)).toBe(true);
  });

  it('claves por servicio: identifica al llamador y revocar una entrada lo deja afuera', () => {
    const { req, ctx } = ctxWith({ 'x-internal-api-key': LARGA_B });
    const both = build(`ecommerce=${LARGA_A},superadmin=${LARGA_B}`);

    expect(both.canActivate(ctx)).toBe(true);
    expect(req['internalCaller']).toBe('superadmin');

    const sinSuperadmin = build(`ecommerce=${LARGA_A}`);
    expect(() => sinSuperadmin.canActivate(ctxWith({ 'x-internal-api-key': LARGA_B }).ctx)).toThrow(UnauthorizedException);
  });

  it('REGRESIÓN: el controller de organizaciones internas conserva este guard', () => {
    const guards = Reflect.getMetadata('__guards__', InternalOrganizationsController) as unknown[];

    expect(guards).toContain(InternalApiKeyGuard);
  });
});
