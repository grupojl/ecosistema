import { describe, expect, it, vi } from 'vitest';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { z } from 'zod';
import { CurrentUser } from './current-user.decorator';
import { IS_PUBLIC_KEY, Public } from './public.decorator';
import { ROLES_KEY, Roles } from './roles.decorator';
import { Tenant } from './tenant.decorator';
import { ZodExceptionFilter } from '@/filters/zod-exception.filter';

/** Ejecuta la fábrica de un decorador de parámetro (createParamDecorator) contra una request simulada. */
function paramFactory(decorator: () => ParameterDecorator, req: unknown) {
  class C {
    handler(@(decorator as () => ParameterDecorator)() _arg: unknown) {}
  }
  const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, C, 'handler') as Record<string, { factory: (d: unknown, c: unknown) => unknown }>;
  const { factory } = Object.values(meta)[0]!;
  return factory(undefined, { switchToHttp: () => ({ getRequest: () => req }) });
}

describe('decoradores', () => {
  it('@Public marca la ruta (el APP_GUARD la deja pasar)', () => {
    class C { @Public() open() {} }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, C.prototype.open)).toBe(true);
    class D { closed() {} }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, D.prototype.closed)).toBeUndefined();
  });

  it('@Roles guarda los roles exigidos', () => {
    class C { @Roles('ADMIN', 'OWNER') admin() {} }
    expect(Reflect.getMetadata(ROLES_KEY, C.prototype.admin)).toEqual(['ADMIN', 'OWNER']);
  });

  it('@CurrentUser entrega el usuario que dejó el guard en la request', () => {
    expect(paramFactory(CurrentUser as never, { user: { uid: 'u1' } })).toEqual({ uid: 'u1' });
    expect(paramFactory(CurrentUser as never, {})).toBeUndefined(); // una ruta pública no tiene usuario
  });

  it('@Tenant entrega el contexto de organización que dejó el guard', () => {
    expect(paramFactory(Tenant as never, { tenant: { organizationId: 'o', role: 'OWNER' } })).toEqual({ organizationId: 'o', role: 'OWNER' });
  });
});

describe('ZodExceptionFilter', () => {
  it('responde 400 con el detalle de cada campo inválido (campo, mensaje y código)', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
    const error = (() => {
      try {
        z.object({ email: z.string().email(), address: z.object({ zip: z.string().min(4) }) }).parse({ email: 'no', address: { zip: '1' } });
      } catch (e) {
        return e as z.ZodError;
      }
      throw new Error('debía fallar');
    })();

    new ZodExceptionFilter().catch(error, host as never);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0]![0];
    expect(body).toMatchObject({ statusCode: 400, error: 'Validation Error' });
    expect(body.details.map((d: { field: string }) => d.field).sort()).toEqual(['address.zip', 'email']);
    expect(body.details.every((d: { message: string; code: string }) => d.message && d.code)).toBe(true);
  });
});
