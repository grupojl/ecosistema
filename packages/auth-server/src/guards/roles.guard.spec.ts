import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { TenantRole } from '@/types/tenant-context';
import { RolesGuard } from './roles.guard';

const run = (required: string[] | undefined, tenant: { role: string } | undefined) => {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const ctx = {
    getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ tenant }) }),
  } as unknown as ExecutionContext;
  return new RolesGuard(reflector).canActivate(ctx);
};

describe('RolesGuard (RBAC jerárquico OWNER > ADMIN > MEMBER > VIEWER)', () => {
  it('sin @Roles el handler está abierto a cualquier usuario del tenant', () => {
    expect(run(undefined, undefined)).toBe(true);
    expect(run([], undefined)).toBe(true);
  });

  it.each<[TenantRole, TenantRole[], boolean]>([
    ['OWNER',  ['OWNER'], true],
    ['ADMIN',  ['OWNER'], false],
    ['OWNER',  ['ADMIN'], true],   // un rol superior cumple el requisito de uno inferior
    ['ADMIN',  ['ADMIN'], true],
    ['MEMBER', ['ADMIN'], false],
    ['VIEWER', ['MEMBER'], false],
    ['MEMBER', ['MEMBER'], true],
    ['VIEWER', ['VIEWER'], true],
  ])('%s con @Roles(%j) => %s', (role, required, allowed) => {
    if (allowed) expect(run(required, { role })).toBe(true);
    else expect(() => run(required, { role })).toThrow(/Rol insuficiente/);
  });

  it('con varios roles alcanza el más bajo (@Roles("ADMIN","MEMBER") deja pasar a un MEMBER)', () => {
    expect(run(['ADMIN', 'MEMBER'], { role: 'MEMBER' })).toBe(true);
    expect(() => run(['ADMIN', 'MEMBER'], { role: 'VIEWER' })).toThrow();
  });

  it('sin TenantContext (TenantGuard no corrió) => Forbidden, no pasa', () => {
    expect(() => run(['VIEWER'], undefined)).toThrow(/TenantContext/);
  });

  it('un rol de usuario desconocido nunca pasa', () => {
    expect(() => run(['VIEWER'], { role: 'SUPERUSER' })).toThrow();
  });

  // Falla cerrado: un typo en el decorador (@Roles('SUPERADMN')) valía nivel 0 => dejaba pasar a CUALQUIERA.
  it('un rol REQUERIDO desconocido (typo en @Roles) no abre el handler', () => {
    expect(() => run(['SUPERADMN'], { role: 'VIEWER' })).toThrow(/Rol insuficiente/);
    expect(() => run(['SUPERADMN'], { role: 'OWNER' })).toThrow(/Rol insuficiente/);
  });
});
