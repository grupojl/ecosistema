import { InvalidPopulationError, MAX_POPULATION, tierForPopulation, toTier } from '@/welver/domain/tiers';
import {
  GRACE_DAYS_DEFAULT,
  addPeriod,
  clampGraceDays,
  daysUntilPeriodEnd,
  effectiveStatus,
  graceEndsAt,
  isPanelWritable,
  isServiceEnabled,
  messageCapState,
  renewalPeriod,
} from '@/welver/domain/subscription-lifecycle';

const d = (iso: string): Date => new Date(iso);

describe('tierForPopulation', () => {
  it.each([
    [1, 1],
    [20_000, 1],
    [20_001, 2],
    [100_000, 2],
    [100_001, 3],
    [500_000, 3],
    [500_001, 4],
    [MAX_POPULATION, 4],
  ])('%i habitantes → tramo %i', (population, tier) => {
    expect(tierForPopulation(population)).toBe(tier);
  });

  it.each([0, -5, 1.5, Number.NaN, MAX_POPULATION + 1])('rechaza población inválida (%p)', (value) => {
    expect(() => tierForPopulation(value)).toThrow(InvalidPopulationError);
  });

  it('toTier estrecha 1–4 y rechaza el resto', () => {
    expect(toTier(3)).toBe(3);
    expect(() => toTier(5)).toThrow(RangeError);
  });
});

describe('ciclo de vida de la suscripción', () => {
  const end = d('2026-11-30T00:00:00Z');
  const base = { status: 'ACTIVE' as const, currentPeriodEnd: end, graceDays: 10 };

  it('ACTIVE mientras el período no venció (incluido el último instante)', () => {
    expect(effectiveStatus(base, d('2026-11-15T00:00:00Z'))).toBe('ACTIVE');
    expect(effectiveStatus(base, end)).toBe('ACTIVE');
  });

  it('GRACE entre el vencimiento y el fin de la gracia', () => {
    expect(effectiveStatus(base, d('2026-12-01T00:00:00Z'))).toBe('GRACE');
    expect(effectiveStatus(base, d('2026-12-10T00:00:00Z'))).toBe('GRACE');
  });

  it('SUSPENDED después de la gracia', () => {
    expect(effectiveStatus(base, d('2026-12-10T00:00:01Z'))).toBe('SUSPENDED');
  });

  it('PENDING y SUSPENDED no cambian con el reloj: solo un pago verificado los mueve', () => {
    const future = d('2030-01-01T00:00:00Z');
    expect(effectiveStatus({ ...base, status: 'PENDING' }, future)).toBe('PENDING');
    expect(effectiveStatus({ ...base, status: 'SUSPENDED', currentPeriodEnd: d('2031-01-01T00:00:00Z') }, future)).toBe('SUSPENDED');
  });

  it('sin período definido conserva el estado guardado', () => {
    expect(effectiveStatus({ status: 'ACTIVE', currentPeriodEnd: null, graceDays: 10 }, d('2030-01-01T00:00:00Z'))).toBe('ACTIVE');
  });

  it('la gracia se mantiene entre 7 y 14 días', () => {
    expect(clampGraceDays(3)).toBe(7);
    expect(clampGraceDays(30)).toBe(14);
    expect(clampGraceDays(Number.NaN)).toBe(GRACE_DAYS_DEFAULT);
    expect(graceEndsAt({ currentPeriodEnd: end, graceDays: 99 })?.toISOString()).toBe('2026-12-14T00:00:00.000Z');
    expect(graceEndsAt({ currentPeriodEnd: null, graceDays: 10 })).toBeNull();
  });

  it('servicio y panel: ACTIVE y GRACE sí; PENDING y SUSPENDED no', () => {
    expect(isServiceEnabled('ACTIVE')).toBe(true);
    expect(isServiceEnabled('GRACE')).toBe(true);
    expect(isServiceEnabled('SUSPENDED')).toBe(false);
    expect(isServiceEnabled('PENDING')).toBe(false);
    expect(isPanelWritable('GRACE')).toBe(true);
    expect(isPanelWritable('SUSPENDED')).toBe(false);
  });

  it('addPeriod no desborda el mes (31/ene + 1 mes = fin de febrero)', () => {
    expect(addPeriod(d('2027-01-31T10:00:00Z'), 'MONTHLY').toISOString()).toBe('2027-02-28T10:00:00.000Z');
    expect(addPeriod(d('2028-01-31T10:00:00Z'), 'MONTHLY').toISOString()).toBe('2028-02-29T10:00:00.000Z');
    expect(addPeriod(d('2026-11-05T00:00:00Z'), 'ANNUAL').toISOString()).toBe('2027-11-05T00:00:00.000Z');
    expect(addPeriod(d('2028-02-29T00:00:00Z'), 'ANNUAL').toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });

  describe('renewalPeriod', () => {
    it('primer pago: arranca hoy', () => {
      const now = d('2026-11-05T12:00:00Z');
      const r = renewalPeriod({ status: 'PENDING', currentPeriodEnd: null, graceDays: 10 }, 'MONTHLY', now);
      expect(r.start).toEqual(now);
      expect(r.end.toISOString()).toBe('2026-12-05T12:00:00.000Z');
    });

    it('pagar antes de vencer continúa desde el fin del período (no regala ni quita días)', () => {
      const r = renewalPeriod(base, 'MONTHLY', d('2026-11-20T00:00:00Z'));
      expect(r.start).toEqual(end);
      expect(r.end.toISOString()).toBe('2026-12-30T00:00:00.000Z');
    });

    it('pagar en gracia también continúa desde el fin del período', () => {
      const r = renewalPeriod(base, 'MONTHLY', d('2026-12-03T00:00:00Z'));
      expect(r.start).toEqual(end);
    });

    it('pagar suspendido arranca hoy', () => {
      const now = d('2027-03-01T00:00:00Z');
      const r = renewalPeriod({ ...base, status: 'SUSPENDED' }, 'ANNUAL', now);
      expect(r.start).toEqual(now);
      expect(r.end.toISOString()).toBe('2028-03-01T00:00:00.000Z');
    });
  });

  it('daysUntilPeriodEnd', () => {
    expect(daysUntilPeriodEnd(end, d('2026-11-20T00:00:00Z'))).toBe(10);
    expect(daysUntilPeriodEnd(end, d('2026-12-02T00:00:00Z'))).toBe(-2);
    expect(daysUntilPeriodEnd(null, d('2026-12-02T00:00:00Z'))).toBeNull();
  });

  it('tope de mensajes: avisa al 80% y nunca corta', () => {
    expect(messageCapState(10, null)).toBe('unlimited');
    expect(messageCapState(79, 100)).toBe('ok');
    expect(messageCapState(80, 100)).toBe('warn');
    expect(messageCapState(100, 100)).toBe('over');
    expect(messageCapState(500, 100)).toBe('over');
  });
});
