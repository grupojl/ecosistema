import { FulfillmentConfigSchema, Market, type MarketProps } from './market.entity';

const base: MarketProps = {
  id: 'm1',
  organizationId: 'org-1',
  countryCode: 'ar',
  isDefault: true,
  isActive: true,
  fulfillmentConfig: { priority: 1 },
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-02T10:00:00.000Z'),
};

describe('Market.fromPrisma', () => {
  it('normaliza el país a mayúsculas', () => {
    expect(Market.fromPrisma(base).countryCode).toBe('AR');
  });

  it('aplica el valor por defecto de priority', () => {
    const m = Market.fromPrisma({ ...base, fulfillmentConfig: {} as MarketProps['fulfillmentConfig'] });
    expect(m.fulfillmentConfig.priority).toBe(1);
  });

  it('acepta el JSON como string (JSONB serializado)', () => {
    const m = Market.fromPrisma({ ...base, fulfillmentConfig: '{"provider":"correo","priority":2}' as unknown as MarketProps['fulfillmentConfig'] });
    expect(m.fulfillmentConfig).toEqual({ provider: 'correo', priority: 2 });
  });

  it('rechaza una config inválida al hidratar (email mal formado, priority < 1)', () => {
    expect(() => Market.fromPrisma({ ...base, fulfillmentConfig: { contactEmail: 'no-es-mail', priority: 1 } })).toThrow();
    expect(() => Market.fromPrisma({ ...base, fulfillmentConfig: { priority: 0 } })).toThrow();
    expect(() => Market.fromPrisma({ ...base, fulfillmentConfig: { priority: 1.5 } })).toThrow();
  });

  it('rechaza un JSON corrupto', () => {
    expect(() => Market.fromPrisma({ ...base, fulfillmentConfig: '{no-json' as unknown as MarketProps['fulfillmentConfig'] })).toThrow();
  });
});

describe('Market.toDTO', () => {
  it('serializa fechas a ISO y conserva los campos', () => {
    expect(Market.fromPrisma(base).toDTO()).toEqual({
      id: 'm1',
      organizationId: 'org-1',
      countryCode: 'AR',
      isDefault: true,
      isActive: true,
      fulfillmentConfig: { priority: 1 },
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
    });
  });
});

describe('FulfillmentConfigSchema', () => {
  it('acepta una config completa', () => {
    expect(FulfillmentConfigSchema.safeParse({ provider: 'x', contactEmail: 'a@b.co', notes: 'n', priority: 3 }).success).toBe(true);
  });
});
