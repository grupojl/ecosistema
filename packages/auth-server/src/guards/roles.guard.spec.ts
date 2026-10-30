import { describe, expect, it } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { TenantRole } from '@/types/tenant-context';

function run(required: TenantRole[] | undefined, role?: TenantRole): boolean {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ tenant: role ? { role } : undefined }) }),
  } as unknown as ExecutionContext;
  return new RolesGuard(reflector).canActivate(ctx);
}

describe('RolesGuard (RBAC jerárquico)', () => {
  it('sin roles requeridos deja pasar, incluso sin tenant', () => {
    expect(run(undefined)).toBe(true);
    expect(run([])).toBe(true);
  });

  it('un rol igual o superior al requerido pasa', () => {
    expect(run(['ADMIN'], 'ADMIN')).toBe(true);
    expect(run(['ADMIN'], 'OWNER')).toBe(true);
    expect(run(['VIEWER'], 'MEMBER')).toBe(true);
  });

  it('un rol inferior es rechazado', () => {
    expect(() => run(['ADMIN'], 'MEMBER')).toThrow(ForbiddenException);
    expect(() => run(['OWNER'], 'ADMIN')).toThrow('Rol insuficiente');
    expect(() => run(['MEMBER'], 'VIEWER')).toThrow(ForbiddenException);
  });

  it('con varios roles alcanza el mínimo de la lista', () => {
    expect(run(['OWNER', 'MEMBER'], 'MEMBER')).toBe(true);
    expect(() => run(['OWNER', 'ADMIN'], 'MEMBER')).toThrow(ForbiddenException);
  });

  it('exigir un rol sin TenantContext es un error (falla cerrado)', () => {
    expect(() => run(['VIEWER'])).toThrow('TenantContext no disponible');
  });

  it('un rol desconocido no tiene privilegios', () => {
    expect(() => run(['VIEWER'], 'HACKER' as TenantRole)).toThrow(ForbiddenException);
  });
});
