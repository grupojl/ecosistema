import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NULLABLE_TENANT_MODELS, TENANT_MODELS, TenantScopeError, scopeArgs } from './tenant-scope';

const ORG = 'org-1';

describe('scopeArgs — lecturas y filtros', () => {
  it.each(['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany', 'update', 'delete'])(
    '%s: inyecta organizationId en el where',
    (op) => {
      expect(scopeArgs('Market', op, { where: { id: 'o1' } }, ORG)).toMatchObject({ where: { id: 'o1', organizationId: ORG } });
    },
  );

  it('sin where lo crea (findMany() no devuelve otras organizaciones)', () => {
    expect(scopeArgs('QuotaConfig', 'findMany', undefined, ORG)).toEqual({ where: { organizationId: ORG } });
    expect(scopeArgs('QuotaConfig', 'findMany', {}, ORG)).toEqual({ where: { organizationId: ORG } });
  });

  it('conserva el resto de los argumentos (include, orderBy, take…)', () => {
    expect(scopeArgs('SecretConfig', 'findMany', { where: { status: 'ACTIVE' }, take: 5, include: { items: true } }, ORG)).toEqual({
      where: { status: 'ACTIVE', organizationId: ORG }, take: 5, include: { items: true },
    });
  });

  it('acepta que el llamador ya indique SU organización', () => {
    expect(scopeArgs('Market', 'findMany', { where: { organizationId: ORG } }, ORG)).toEqual({ where: { organizationId: ORG } });
  });

  it('rechaza una query dirigida a OTRA organización', () => {
    expect(() => scopeArgs('Market', 'findMany', { where: { organizationId: 'otra' } }, ORG)).toThrow(TenantScopeError);
    expect(() => scopeArgs('Market', 'findUnique', { where: { id: 'o1', organizationId: 'otra' } }, ORG)).toThrow('fuera del tenant');
  });

  it('rechaza un filtro de organización que no sea igualdad simple (in, not, OR…)', () => {
    expect(() => scopeArgs('Market', 'findMany', { where: { organizationId: { in: [ORG, 'otra'] } } }, ORG)).toThrow(TenantScopeError);
    expect(() => scopeArgs('Market', 'findMany', { where: { organizationId: { not: ORG } } }, ORG)).toThrow(TenantScopeError);
  });

  it('un OR en el where no puede escapar del tenant (organizationId va al nivel superior, en AND implícito)', () => {
    const scoped = scopeArgs('Market', 'findMany', { where: { OR: [{ id: 'a' }, { id: 'b' }] } }, ORG) as { where: Record<string, unknown> };
    expect(scoped.where['organizationId']).toBe(ORG);
    expect(scoped.where['OR']).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});

describe('scopeArgs — escrituras', () => {
  it('create: fija el tenant en data', () => {
    expect(scopeArgs('Market', 'create', { data: { customerId: 'c1' } }, ORG)).toEqual({ data: { customerId: 'c1', organizationId: ORG } });
  });

  it('create: rechaza crear en otro tenant', () => {
    expect(() => scopeArgs('Market', 'create', { data: { organizationId: 'otra' } }, ORG)).toThrow(TenantScopeError);
  });

  it('createMany: fija el tenant en cada fila, sea arreglo u objeto', () => {
    expect(scopeArgs('WebhookEndpoint', 'createMany', { data: [{ handle: 'a' }, { handle: 'b' }] }, ORG)).toEqual({
      data: [{ handle: 'a', organizationId: ORG }, { handle: 'b', organizationId: ORG }],
    });
    expect(() => scopeArgs('WebhookEndpoint', 'createMany', { data: [{ handle: 'a' }, { organizationId: 'otra' }] }, ORG)).toThrow(TenantScopeError);
  });

  it('update: no permite mover una fila a otro tenant', () => {
    expect(() => scopeArgs('QuotaConfig', 'update', { where: { id: 'p' }, data: { organizationId: 'otra' } }, ORG)).toThrow(TenantScopeError);
    expect(scopeArgs('QuotaConfig', 'update', { where: { id: 'p' }, data: { name: 'x' } }, ORG)).toEqual({
      where: { id: 'p', organizationId: ORG }, data: { name: 'x' },
    });
  });

  it('upsert: acota el where y fija el tenant al crear', () => {
    expect(scopeArgs('WebhookEndpoint', 'upsert', { where: { id: 'c' }, create: { handle: 'h' }, update: { handle: 'h2' } }, ORG)).toEqual({
      where: { id: 'c', organizationId: ORG }, create: { handle: 'h', organizationId: ORG }, update: { handle: 'h2' },
    });
    expect(() => scopeArgs('WebhookEndpoint', 'upsert', { where: { id: 'c' }, create: { organizationId: 'otra' }, update: {} }, ORG)).toThrow(TenantScopeError);
  });

  it('una operación desconocida se rechaza (nunca pasa sin alcance)', () => {
    expect(() => scopeArgs('Market', 'inventadaOperacion', {}, ORG)).toThrow('no está soportada');
  });
});

describe('scopeArgs — modelos sin tenant', () => {
  it('los hijos (OrderItem, CartItem…) no se tocan: se alcanzan por su padre', () => {
    const args = { where: { orderId: 'o1' } };
    expect(scopeArgs('WebhookDeliveryLog', 'findMany', args, ORG)).toBe(args);
    expect(scopeArgs('Invitation', 'create', { data: {} }, ORG)).toEqual({ data: {} });
  });
});

describe('TENANT_MODELS vs schema.prisma', () => {
  const schema = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');

  /** Modelos del schema que tienen un campo organizationId. */
  const withTenantField = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
    .filter(([, , body]) => /^\s*organizationId\s/m.test(body!))
    .map(([, name]) => name!)
    .sort();

  it('lista exactamente los modelos que tienen organizationId (si agregás uno, agregalo acá)', () => {
    expect([...TENANT_MODELS, ...NULLABLE_TENANT_MODELS].sort()).toEqual(withTenantField);
  });
});

describe('modelos con organizationId opcional (filas globales)', () => {
  it('NO se acotan: una consulta sobre FeatureFlag sigue viendo las filas globales', () => {
    const args = { where: { key: 'x' } };
    expect(scopeArgs('FeatureFlag', 'findMany', args, ORG)).toBe(args);
  });
});
