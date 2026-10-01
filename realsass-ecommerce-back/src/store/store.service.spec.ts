import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { StoreService } from '@/store/store.service';
import { parseSassBackStoreResponse } from '@/store/store.contract';

const ORG_ID = '6f1c2a3b-0000-4000-8000-000000000001';

const validStore = {
  organizationId:   ORG_ID,
  slug:             'mi-marca',
  name:             'Mi Marca',
  description:      null,
  logoUrl:          null,
  website:          null,
  countryCode:      'BR',
  ecommerceEnabled: true,
};

function mockFetch(status: number, body: unknown): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    status,
    ok:   status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('parseSassBackStoreResponse (contrato)', () => {
  it('acepta respuesta envuelta { success, data }', () => {
    expect(parseSassBackStoreResponse({ success: true, data: validStore })?.countryCode).toBe('BR');
  });

  it('acepta respuesta plana', () => {
    expect(parseSassBackStoreResponse(validStore)?.slug).toBe('mi-marca');
  });

  it('tolerant reader: sin countryCode → AR', () => {
    const { countryCode: _omit, ...legacy } = validStore;
    expect(parseSassBackStoreResponse(legacy)?.countryCode).toBe('AR');
  });

  it('countryCode inválido → AR (no rompe la tienda)', () => {
    expect(parseSassBackStoreResponse({ ...validStore, countryCode: 'BRA' })?.countryCode).toBe('AR');
  });

  it('shape inválido → null', () => {
    expect(parseSassBackStoreResponse({ foo: 'bar' })).toBeNull();
    expect(parseSassBackStoreResponse({ ...validStore, organizationId: 'no-uuid' })).toBeNull();
  });
});

describe('StoreService.resolveBySlug', () => {
  const originalEnv = process.env['SASS_BACK_URL'];
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env['SASS_BACK_URL'] = 'http://sass-back.test/api/v1';
  });

  afterEach(() => {
    process.env['SASS_BACK_URL'] = originalEnv;
    fetchSpy?.mockRestore();
  });

  it('devuelve StoreInfo validado con countryCode', async () => {
    fetchSpy = mockFetch(200, { success: true, data: validStore });
    const store = await new StoreService().resolveBySlug('mi marca');
    expect(store.countryCode).toBe('BR');
    expect(fetchSpy.mock.calls[0][0]).toBe('http://sass-back.test/api/v1/organizations/public/by-slug/mi%20marca');
  });

  it('404 upstream → NotFound', async () => {
    fetchSpy = mockFetch(404, {});
    await expect(new StoreService().resolveBySlug('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ecommerce deshabilitado → NotFound', async () => {
    fetchSpy = mockFetch(200, { ...validStore, ecommerceEnabled: false });
    await expect(new StoreService().resolveBySlug('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('5xx upstream → 503 (Google no desindexa)', async () => {
    fetchSpy = mockFetch(502, {});
    await expect(new StoreService().resolveBySlug('x')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('error de red → 503', async () => {
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    await expect(new StoreService().resolveBySlug('x')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('contrato roto upstream → 503', async () => {
    fetchSpy = mockFetch(200, { unexpected: true });
    await expect(new StoreService().resolveBySlug('x')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('SASS_BACK_URL vacío → 503', async () => {
    process.env['SASS_BACK_URL'] = '';
    fetchSpy = mockFetch(200, validStore);
    await expect(new StoreService().resolveBySlug('x')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
