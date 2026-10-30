/**
 * tenant-scope.ts — aislamiento por tenant a nivel de cliente Prisma (ADR-029, fase 2).
 *
 * Con `prisma.forTenant(organizationId)` ya no hace falta recordar `where: { organizationId }` en cada query:
 * el alcance se inyecta solo, y una query que intente leer o escribir OTRA organización falla en vez de filtrarse.
 *
 * Cubre las operaciones del cliente Prisma sobre los modelos con `organizationId`. NO cubre SQL crudo
 * (`$queryRaw` / `$executeRaw`): ahí el filtro sigue siendo manual (y RLS, ver prisma/rls/, es la red de seguridad).
 * La lista de modelos la verifica tenant-scope.spec.ts contra schema.prisma: un modelo nuevo con `organizationId`
 * que no esté acá hace fallar el test.
 */
import type { PrismaClient } from '@/generated/prisma';

export const TENANT_MODELS = [
  'Category',
  'Product',
  'ProductVariant',
  'InventoryItem',
  'StoreCustomer',
  'CustomerActivityEvent',
  'Cart',
  'Order',
  'OutboxEvent',
] as const;

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

type Args = Record<string, unknown>;

const WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

const isTenantModel = (model: string): boolean =>
  (TENANT_MODELS as readonly string[]).includes(model);

/** El `organizationId` que ya trae la query debe ser exactamente el del tenant (igualdad simple, sin filtros). */
function assertSameTenant(
  value: unknown,
  organizationId: string,
  where: string,
): void {
  if (value === undefined) return;
  if (value !== organizationId) {
    throw new TenantScopeError(
      `Operación fuera del tenant: ${where}.organizationId no coincide con la organización activa`,
    );
  }
}

function scopeWhere(where: unknown, organizationId: string): Args {
  const current = (where ?? {}) as Args;
  assertSameTenant(current['organizationId'], organizationId, 'where');
  return { ...current, organizationId };
}

function scopeData(
  data: unknown,
  organizationId: string,
  forCreate: boolean,
): Args {
  const current = (data ?? {}) as Args;
  assertSameTenant(current['organizationId'], organizationId, 'data'); // tampoco se puede mover una fila a otro tenant
  return forCreate ? { ...current, organizationId } : current;
}

/** Devuelve los argumentos de la query con el tenant inyectado, o lanza si intenta salirse de él. */
export function scopeArgs(
  model: string,
  operation: string,
  args: unknown,
  organizationId: string,
): Args {
  const input = (args ?? {}) as Args;
  if (!isTenantModel(model)) return input;

  if (WHERE_OPERATIONS.has(operation)) {
    const scoped: Args = {
      ...input,
      where: scopeWhere(input['where'], organizationId),
    };
    if ('data' in input)
      scoped['data'] = scopeData(input['data'], organizationId, false);
    return scoped;
  }

  switch (operation) {
    case 'create':
      return { ...input, data: scopeData(input['data'], organizationId, true) };
    case 'createMany':
    case 'createManyAndReturn': {
      const data = input['data'];
      const rows = Array.isArray(data) ? data : [data];
      const scoped = rows.map((row) => scopeData(row, organizationId, true));
      return { ...input, data: Array.isArray(data) ? scoped : scoped[0] };
    }
    case 'upsert':
      return {
        ...input,
        where: scopeWhere(input['where'], organizationId),
        create: scopeData(input['create'], organizationId, true),
        update: scopeData(input['update'], organizationId, false),
      };
    default:
      // Operación que este módulo no conoce: se rechaza antes que dejarla pasar sin alcance.
      throw new TenantScopeError(
        `Operación "${operation}" sobre ${model} no está soportada en un cliente con alcance de tenant`,
      );
  }
}

/** Cliente Prisma limitado a una organización. */
export function withTenant<C extends PrismaClient>(
  client: C,
  organizationId: string,
) {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new TenantScopeError('forTenant requiere un organizationId');
  }
  return client.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args, organizationId));
        },
      },
    },
  });
}
