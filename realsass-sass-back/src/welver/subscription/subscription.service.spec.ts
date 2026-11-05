import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';

const ORG = 'org-1';
const d = (iso: string): Date => new Date(iso);

function sub(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    organizationId: ORG,
    tier: 2,
    period: 'MONTHLY',
    billingMode: 'MANUAL',
    status: 'PENDING',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    graceDays: 10,
    messageCap: null,
    isPilot: true,
    ...over,
  };
}

function setup(opts: { sub?: ReturnType<typeof sub> | null; population?: number | null; invoice?: Record<string, unknown> | null } = {}) {
  const stored = opts.sub === undefined ? sub() : opts.sub;
  const tenant = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(stored),
      create: jest.fn().mockImplementation(({ data }) => ({ op: 'createSub', data })),
      update: jest.fn().mockImplementation(({ data }) => ({ op: 'updateSub', data })),
    },
    subscriptionInvoice: {
      findFirst: jest.fn().mockResolvedValue(opts.invoice === undefined ? { id: 'inv1', status: 'PENDING' } : opts.invoice),
      create: jest.fn().mockImplementation(({ data }) => ({ op: 'createInvoice', data })),
      update: jest.fn().mockImplementation(({ data }) => ({ op: 'updateInvoice', data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    entityChannel: { updateMany: jest.fn().mockImplementation((args) => ({ op: 'channels', args })) },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
  };
  const root = {
    forTenant: jest.fn().mockReturnValue(tenant),
    organization: { findUnique: jest.fn().mockResolvedValue({ population: opts.population === undefined ? 50_000 : opts.population }) },
    subscription: { findMany: jest.fn(), update: jest.fn() },
    entityChannel: { updateMany: jest.fn() },
  };
  const audit = { log: jest.fn() };
  const service = new SubscriptionService(root as unknown as PrismaService, audit as unknown as ConfigAuditService);
  return { service, tenant, root, audit };
}

describe('SubscriptionService.create', () => {
  it('deriva el tramo de la población y queda PENDING con su primera factura', async () => {
    const { service, tenant } = setup({ sub: null, population: 150_000 });
    tenant.subscription.findUnique.mockResolvedValueOnce(null);
    tenant.subscription.findUnique.mockResolvedValue(sub({ tier: 3 }));
    const view = await service.create(ORG, 'u1', { period: 'ANNUAL' }, d('2026-11-05T00:00:00Z'));

    const [ops] = tenant.$transaction.mock.calls[0] as [{ op: string; data: Record<string, unknown> }[]];
    expect(ops[0]).toMatchObject({ op: 'createSub', data: { tier: 3, period: 'ANNUAL', billingMode: 'MANUAL' } });
    expect(ops[1]).toMatchObject({ op: 'createInvoice', data: { organizationId: ORG } });
    expect(ops[1]?.data).not.toHaveProperty('amountCents'); // los montos de los tramos siguen pendientes
    expect((ops[1]?.data['periodEnd'] as Date).toISOString()).toBe('2027-11-05T00:00:00.000Z');
    expect(view.tier).toBe(3);
  });

  it('sin población cargada no se puede contratar', async () => {
    const { service } = setup({ sub: null, population: null });
    await expect(service.create(ORG, 'u1', { period: 'MONTHLY' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un municipio no contrata dos veces', async () => {
    const { service } = setup({ sub: sub() });
    await expect(service.create(ORG, 'u1', { period: 'MONTHLY' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SubscriptionService.get', () => {
  it('muestra el estado REAL con la fecha, aunque el guardado diga ACTIVE', async () => {
    const { service } = setup({ sub: sub({ status: 'ACTIVE', currentPeriodEnd: d('2026-11-30T00:00:00Z') }) });
    expect((await service.get(ORG, d('2026-12-02T00:00:00Z')))?.status).toBe('GRACE');
    expect((await service.get(ORG, d('2026-12-20T00:00:00Z')))?.status).toBe('SUSPENDED');
    expect((await service.get(ORG, d('2026-12-20T00:00:00Z')))?.panelWritable).toBe(false);
  });

  it('avisa si la población actual corresponde a otro tramo que el contratado', async () => {
    const { service } = setup({ sub: sub({ tier: 1 }), population: 80_000 });
    expect((await service.get(ORG))?.tierMismatch).toBe(true);
  });

  it('null si el municipio no contrató', async () => {
    const { service } = setup({ sub: null });
    expect(await service.get(ORG)).toBeNull();
  });
});

describe('SubscriptionService.markInvoicePaid', () => {
  const now = d('2026-11-05T12:00:00Z');

  it('el primer pago activa el paquete, abre el período, deja la factura siguiente y reanuda los canales', async () => {
    const { service, tenant, audit } = setup({ sub: sub({ status: 'PENDING' }) });
    tenant.subscription.findUnique.mockResolvedValueOnce(sub({ status: 'PENDING' })).mockResolvedValue(sub({ status: 'ACTIVE', currentPeriodEnd: d('2026-12-05T12:00:00Z') }));
    await service.markInvoicePaid(ORG, 'inv1', 'admin', 'TRF-123', now);

    const [ops] = tenant.$transaction.mock.calls[0] as [{ op: string; data?: Record<string, unknown>; args?: Record<string, unknown> }[]];
    expect(ops[0]).toMatchObject({ op: 'updateInvoice', data: { status: 'PAID', markedPaidBy: 'admin', reference: 'TRF-123' } });
    expect(ops[1]).toMatchObject({ op: 'updateSub', data: { status: 'ACTIVE' } });
    expect((ops[1]?.data?.['currentPeriodEnd'] as Date).toISOString()).toBe('2026-12-05T12:00:00.000Z');
    expect(ops[2]).toMatchObject({ op: 'createInvoice' });
    expect(ops.filter((o) => o.op === 'channels')).toHaveLength(2);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'invoice_paid' }));
  });

  it('es idempotente: una factura ya pagada no extiende el período otra vez', async () => {
    const { service, tenant } = setup({ sub: sub({ status: 'ACTIVE', currentPeriodEnd: d('2026-12-05T12:00:00Z') }), invoice: { id: 'inv1', status: 'PAID' } });
    await service.markInvoicePaid(ORG, 'inv1', 'admin', undefined, now);
    expect(tenant.$transaction).not.toHaveBeenCalled();
  });

  it('una factura anulada no se paga', async () => {
    const { service } = setup({ invoice: { id: 'inv1', status: 'VOID' } });
    await expect(service.markInvoicePaid(ORG, 'inv1', 'admin', undefined, now)).rejects.toBeInstanceOf(ConflictException);
  });

  it('factura o paquete inexistentes son NotFound', async () => {
    await expect(setup({ invoice: null }).service.markInvoicePaid(ORG, 'x', 'a')).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ sub: null }).service.markInvoicePaid(ORG, 'x', 'a')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SubscriptionService.syncStatuses', () => {
  const now = d('2026-12-20T00:00:00Z');

  it('pasa ACTIVE → GRACE → SUSPENDED según la fecha y pausa los canales solo al suspender', async () => {
    const { service, root } = setup();
    root.subscription.findMany.mockResolvedValue([
      sub({ id: 'a', organizationId: 'org-a', status: 'ACTIVE', currentPeriodEnd: d('2027-01-30T00:00:00Z') }), // vigente
      sub({ id: 'b', organizationId: 'org-b', status: 'ACTIVE', currentPeriodEnd: d('2026-12-15T00:00:00Z') }), // en gracia
      sub({ id: 'c', organizationId: 'org-c', status: 'GRACE', currentPeriodEnd: d('2026-11-30T00:00:00Z') }), // venció la gracia
    ]);
    const result = await service.syncStatuses(now);

    expect(result).toEqual({ checked: 3, changed: 2, suspended: 1 });
    expect(root.subscription.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { status: 'GRACE' } });
    expect(root.subscription.update).toHaveBeenCalledWith({ where: { id: 'c' }, data: { status: 'SUSPENDED' } });
    expect(root.entityChannel.updateMany).toHaveBeenCalledTimes(1);
    expect(root.entityChannel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-c' }), data: expect.objectContaining({ status: 'PAUSED', pausedReason: 'SUBSCRIPTION' }) }),
    );
  });

  it('no toca lo que ya está al día', async () => {
    const { service, root } = setup();
    root.subscription.findMany.mockResolvedValue([sub({ status: 'ACTIVE', currentPeriodEnd: d('2027-06-01T00:00:00Z') })]);
    expect(await service.syncStatuses(now)).toEqual({ checked: 1, changed: 0, suspended: 0 });
    expect(root.subscription.update).not.toHaveBeenCalled();
  });
});

describe('SubscriptionService.assertWritable', () => {
  it('permite escribir con el paquete activo o en gracia', async () => {
    const { service } = setup({ sub: sub({ status: 'ACTIVE', currentPeriodEnd: d('2026-11-30T00:00:00Z') }) });
    await expect(service.assertWritable(ORG, d('2026-11-10T00:00:00Z'))).resolves.toBeUndefined();
    await expect(service.assertWritable(ORG, d('2026-12-03T00:00:00Z'))).resolves.toBeUndefined();
  });

  it('suspendido o sin primer pago: solo lectura', async () => {
    const suspended = setup({ sub: sub({ status: 'ACTIVE', currentPeriodEnd: d('2026-11-30T00:00:00Z') }) });
    await expect(suspended.service.assertWritable(ORG, d('2027-01-30T00:00:00Z'))).rejects.toBeInstanceOf(ForbiddenException);
    const pending = setup({ sub: sub({ status: 'PENDING' }) });
    await expect(pending.service.assertWritable(ORG)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sin fila de paquete deja escribir (decisión abierta, documentada en el servicio)', async () => {
    await expect(setup({ sub: null }).service.assertWritable(ORG)).resolves.toBeUndefined();
  });
});
