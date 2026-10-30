import { MAX_ATTEMPTS, nextDelayMs } from './outbox-backoff';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxService } from './outbox.service';
import type { OutboxPublisher } from './outbox.types';

describe('nextDelayMs', () => {
  it('crece exponencialmente: 2 s, 4 s, 8 s…', () => {
    expect([1, 2, 3, 4].map(nextDelayMs)).toEqual([2_000, 4_000, 8_000, 16_000]);
  });

  it('tiene un tope de 5 minutos', () => {
    expect(nextDelayMs(9)).toBe(300_000);
    expect(nextDelayMs(50)).toBe(300_000);
  });

  it('tolera valores raros (0, negativos, decimales)', () => {
    expect(nextDelayMs(0)).toBe(2_000);
    expect(nextDelayMs(-3)).toBe(2_000);
    expect(nextDelayMs(2.9)).toBe(4_000);
  });
});

describe('OutboxService', () => {
  const original = process.env['OUTBOX_ENABLED'];
  afterEach(() => {
    if (original === undefined) delete process.env['OUTBOX_ENABLED'];
    else process.env['OUTBOX_ENABLED'] = original;
  });

  it('está apagado por defecto y solo se activa con "true"', () => {
    const s = new OutboxService();
    delete process.env['OUTBOX_ENABLED'];
    expect(s.enabled).toBe(false);
    process.env['OUTBOX_ENABLED'] = '1';
    expect(s.enabled).toBe(false);
    process.env['OUTBOX_ENABLED'] = 'true';
    expect(s.enabled).toBe(true);
  });

  it('enqueue escribe el evento con el cliente de LA transacción recibida', async () => {
    const create = jest.fn().mockResolvedValue({});
    await new OutboxService().enqueue({ outboxEvent: { create } } as never, {
      organizationId: 'org-1', aggregateType: 'Order', aggregateId: 'o1', type: 'order.created', payload: { totalCents: 10 },
    });
    expect(create).toHaveBeenCalledWith({
      data: { organizationId: 'org-1', aggregateType: 'Order', aggregateId: 'o1', type: 'order.created', payload: { totalCents: 10 } },
    });
  });

  it('si la escritura falla, el error se propaga (la transacción del negocio se revierte)', async () => {
    const create = jest.fn().mockRejectedValue(new Error('tabla inexistente'));
    await expect(new OutboxService().enqueue({ outboxEvent: { create } } as never, {
      organizationId: 'o', aggregateType: 'Order', aggregateId: 'x', type: 't', payload: {},
    })).rejects.toThrow('tabla inexistente');
  });
});

/** La primera llamada a $queryRaw fija el contexto de sistema (RLS); la que reserva filas es la que consulta outbox_events. */
const claimCall = (tx: { $queryRaw: jest.Mock }): unknown[] =>
  tx.$queryRaw.mock.calls.find((c) => (c[0] as TemplateStringsArray).join('?').includes('outbox_events'))!;
const claimSql = (tx: { $queryRaw: jest.Mock }): string => (claimCall(tx)[0] as TemplateStringsArray).join('?');

describe('OutboxRelayService.processBatch', () => {
  const row = (id: string, attempts = 0) => ({
    id, organizationId: 'org-1', aggregateType: 'Order', aggregateId: `agg-${id}`, type: 'order.created',
    payload: { n: 1 }, attempts, createdAt: new Date('2026-10-30T10:00:00Z'),
  });

  function build(rows: Array<ReturnType<typeof row>>, publisher: OutboxPublisher) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue(rows.map((r) => ({ id: r.id }))),
      outboxEvent: { findMany: jest.fn().mockResolvedValue(rows), update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
    return { tx, service: new OutboxRelayService(prisma as never, publisher) };
  }

  it('fija el contexto de sistema antes de reservar filas (necesario con RLS activo)', async () => {
    const { service, tx } = build([], { publish: jest.fn() });
    await service.processBatch();
    const first = (tx.$queryRaw.mock.calls[0]![0] as TemplateStringsArray).join('?');
    expect(first).toContain("set_config('app.bypass_rls', 'on', true)");
  });

  it('sin pendientes no hace nada', async () => {
    const publish = jest.fn();
    const { service, tx } = build([], { publish });
    await expect(service.processBatch()).resolves.toEqual({ published: 0, failed: 0 });
    expect(publish).not.toHaveBeenCalled();
    expect(tx.outboxEvent.findMany).not.toHaveBeenCalled();
  });

  it('publica cada evento y lo marca como procesado', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const { service, tx } = build([row('e1'), row('e2')], { publish });
    await expect(service.processBatch()).resolves.toEqual({ published: 2, failed: 0 });

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish.mock.calls[0]![0]).toMatchObject({ id: 'e1', type: 'order.created', organizationId: 'org-1', payload: { n: 1 } });
    for (const call of tx.outboxEvent.update.mock.calls) {
      expect(call[0].data.processedAt).toBeInstanceOf(Date);
      expect(call[0].data.lastError).toBeNull();
    }
  });

  it('reserva las filas con FOR UPDATE SKIP LOCKED (varias instancias no se pisan)', async () => {
    const { service, tx } = build([row('e1')], { publish: jest.fn() });
    await service.processBatch();
    const sql = claimSql(tx);
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('processed_at IS NULL');
  });

  it('un fallo reintenta más tarde: suma intento, guarda el error y difiere availableAt', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('WhatsApp caído'));
    const { service, tx } = build([row('e1', 2)], { publish });
    const before = Date.now();
    await expect(service.processBatch()).resolves.toEqual({ published: 0, failed: 1 });

    const data = tx.outboxEvent.update.mock.calls[0]![0].data;
    expect(data.attempts).toBe(3);
    expect(data.lastError).toBe('WhatsApp caído');
    expect(data.processedAt).toBeUndefined();
    expect(data.availableAt.getTime()).toBeGreaterThanOrEqual(before + nextDelayMs(3));
  });

  it('un evento que falla no impide publicar los siguientes', async () => {
    const publish = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    const { service } = build([row('e1'), row('e2')], { publish });
    await expect(service.processBatch()).resolves.toEqual({ published: 1, failed: 1 });
  });

  it('recorta mensajes de error larguísimos', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('x'.repeat(5_000)));
    const { service, tx } = build([row('e1')], { publish });
    await service.processBatch();
    expect(tx.outboxEvent.update.mock.calls[0]![0].data.lastError).toHaveLength(500);
  });

  it('no consulta eventos que ya agotaron los intentos', async () => {
    const { service, tx } = build([], { publish: jest.fn() });
    await service.processBatch();
    const values = claimCall(tx).slice(1);
    expect(values).toContain(MAX_ATTEMPTS);
  });
});

describe('OutboxRelayService — ciclo de vida', () => {
  const original = process.env['OUTBOX_RELAY_ENABLED'];
  afterEach(() => {
    if (original === undefined) delete process.env['OUTBOX_RELAY_ENABLED'];
    else process.env['OUTBOX_RELAY_ENABLED'] = original;
    jest.useRealTimers();
  });

  it('apagado por defecto: no arranca ningún temporizador', () => {
    jest.useFakeTimers();
    delete process.env['OUTBOX_RELAY_ENABLED'];
    const prisma = { $transaction: jest.fn() };
    const service = new OutboxRelayService(prisma as never, { publish: jest.fn() });
    service.onModuleInit();
    jest.advanceTimersByTime(60_000);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('activo: consulta periódicamente y se detiene al cerrar', async () => {
    jest.useFakeTimers();
    process.env['OUTBOX_RELAY_ENABLED'] = 'true';
    const prisma = { $transaction: jest.fn().mockResolvedValue({ published: 0, failed: 0 }) };
    const service = new OutboxRelayService(prisma as never, { publish: jest.fn() });
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(2_100);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('un error del relay no tumba el proceso', async () => {
    jest.useFakeTimers();
    process.env['OUTBOX_RELAY_ENABLED'] = 'true';
    const prisma = { $transaction: jest.fn().mockRejectedValue(new Error('base caída')) };
    const service = new OutboxRelayService(prisma as never, { publish: jest.fn() });
    service.onModuleInit();
    await expect(jest.advanceTimersByTimeAsync(2_100)).resolves.not.toThrow();
    service.onModuleDestroy();
  });
});
