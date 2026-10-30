import { runAsTenant, setTenantContext } from './tenant-context';

function fakeTx() {
  const calls: string[] = [];
  const tx = { $queryRaw: jest.fn(async () => { calls.push('set_config'); return []; }) };
  const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
  return { calls, tx, prisma };
}

describe('tenant-context (RLS)', () => {
  it('fija app.organization_id con alcance de transacción (set_config … true)', async () => {
    const { tx } = fakeTx();
    await setTenantContext(tx as never, 'org-1');
    const [strings, value] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
    expect(strings.join('?')).toContain("set_config('app.organization_id', ?, true)");
    expect(value).toBe('org-1');
  });

  it('rechaza un organizationId vacío', async () => {
    await expect(setTenantContext(fakeTx().tx as never, '')).rejects.toThrow('organizationId');
  });

  it('runAsTenant fija el tenant ANTES de ejecutar la lógica, en la misma transacción', async () => {
    const { calls, prisma } = fakeTx();
    const result = await runAsTenant(prisma as never, 'org-1', async () => { calls.push('logica'); return 42; });
    expect(result).toBe(42);
    expect(calls).toEqual(['set_config', 'logica']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('si la lógica falla, el error se propaga (la transacción hace rollback)', async () => {
    const { prisma } = fakeTx();
    await expect(runAsTenant(prisma as never, 'org-1', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
