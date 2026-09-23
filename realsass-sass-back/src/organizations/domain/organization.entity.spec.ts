import { toPublicStoreInfo, type PublicStoreRow } from './organization.entity';

const baseRow: PublicStoreRow = {
  id:          '6f1c2a3b-0000-4000-8000-000000000001',
  slug:        'mi-marca',
  name:        'Mi Marca',
  description: 'Ropa urbana',
  logoUrl:     null,
  website:     null,
  countryCode: 'AR',
  storeStatus: 'ACTIVE',
};

describe('toPublicStoreInfo', () => {
  it('mapea una org activa con su país', () => {
    expect(toPublicStoreInfo(baseRow)).toEqual({
      organizationId:   baseRow.id,
      slug:             'mi-marca',
      name:             'Mi Marca',
      description:      'Ropa urbana',
      logoUrl:          null,
      website:          null,
      countryCode:      'AR',
      ecommerceEnabled: true,
    });
  });

  it('storeStatus PAUSED → ecommerceEnabled false (ADR-013)', () => {
    expect(toPublicStoreInfo({ ...baseRow, storeStatus: 'PAUSED' })?.ecommerceEnabled).toBe(false);
  });

  it('sin slug → null (no hay tienda pública)', () => {
    expect(toPublicStoreInfo({ ...baseRow, slug: null })).toBeNull();
  });

  it('normaliza countryCode a mayúsculas', () => {
    expect(toPublicStoreInfo({ ...baseRow, countryCode: ' br ' })?.countryCode).toBe('BR');
  });

  it('countryCode corrupto → país default, nunca lanza', () => {
    expect(toPublicStoreInfo({ ...baseRow, countryCode: 'ARG' })?.countryCode).toBe('AR');
    expect(toPublicStoreInfo({ ...baseRow, countryCode: '' })?.countryCode).toBe('AR');
  });
});
