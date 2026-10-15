import { FulfillmentConfigSchema, Market } from '@/markets/domain/market.entity';

const raw = (overrides: Record<string, unknown> = {}) => ({
  id: 'm-1', organizationId: 'org-1', countryCode: 'ar', isDefault: true, isActive: true,
  fulfillmentConfig: {}, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z'),
  ...overrides,
});

describe('FulfillmentConfigSchema', () => {
  it('aplica el default priority=1', () => {
    expect(FulfillmentConfigSchema.parse({})).toEqual({ priority: 1 });
  });

  it('valida email, entero y mínimo', () => {
    expect(() => FulfillmentConfigSchema.parse({ contactEmail: 'no-es-email' })).toThrow();
    expect(() => FulfillmentConfigSchema.parse({ priority: 0 })).toThrow();
    expect(() => FulfillmentConfigSchema.parse({ priority: 1.5 })).toThrow();
    expect(FulfillmentConfigSchema.parse({ provider: 'envia', contactEmail: 'a@b.co', priority: 3 })).toMatchObject({ priority: 3 });
  });
});

describe('Market.fromPrisma', () => {
  it('normaliza el país a mayúsculas', () => {
    expect(Market.fromPrisma(raw({ countryCode: 'br' })).countryCode).toBe('BR');
  });

  it('hidrata el JSON de la base validándolo con Zod (acepta objeto o string JSON)', () => {
    expect(Market.fromPrisma(raw({ fulfillmentConfig: { provider: 'envia' } })).fulfillmentConfig).toEqual({ provider: 'envia', priority: 1 });
    expect(Market.fromPrisma(raw({ fulfillmentConfig: '{"provider":"correo","priority":2}' })).fulfillmentConfig).toEqual({ provider: 'correo', priority: 2 });
  });

  it('un JSON inválido en la base NO se hidrata (no entra basura al dominio)', () => {
    expect(() => Market.fromPrisma(raw({ fulfillmentConfig: { priority: -3 } }))).toThrow();
    expect(() => Market.fromPrisma(raw({ fulfillmentConfig: '{no es json' }))).toThrow();
  });

  it('toDTO serializa las fechas a ISO', () => {
    const dto = Market.fromPrisma(raw()).toDTO();
    expect(dto).toMatchObject({ id: 'm-1', organizationId: 'org-1', countryCode: 'AR', isDefault: true, isActive: true });
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });
});
