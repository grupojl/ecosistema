/**
 * tenant-context.ts — contexto de tenant para Row-Level Security (ADR-029, fase 4).
 *
 * Las políticas RLS (prisma/rls/enable-rls.sql) leen `app.organization_id`. Se fija con `set_config(..., true)`,
 * que vale SOLO hasta el final de la transacción actual: con un pool de conexiones compartido nunca se filtra a
 * otra request. Por eso toda query de un tenant debe correr dentro de `runAsTenant`.
 */
import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransactionClient } from '@/prisma/prisma.service';

export async function setTenantContext(
  tx: PrismaTransactionClient,
  organizationId: string,
): Promise<void> {
  if (!organizationId)
    throw new Error('setTenantContext requiere un organizationId');
  await tx.$queryRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
}

/**
 * Trabajos de SISTEMA sin tenant (relay del outbox, purgas): ven todas las filas. Vale solo en la transacción actual.
 * Nunca debe armarse a partir de datos del usuario.
 */
export async function setSystemContext(
  tx: PrismaTransactionClient,
): Promise<void> {
  await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
}

/** Corre `fn` en una transacción con el tenant fijado para RLS. */
export function runAsTenant<T>(
  prisma: Pick<PrismaClient, '$transaction'>,
  organizationId: string,
  fn: (tx: PrismaTransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const client = tx as unknown as PrismaTransactionClient;
    await setTenantContext(client, organizationId);
    return fn(client);
  });
}
