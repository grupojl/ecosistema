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

  describe('listStores (índice de sitemaps)', () => {
    const rows = [{ slug: 'mi-marca', countryCode: 'AR', updatedAt: '2026-10-01T00:00:00.000Z' }]

    it('devuelve solo slug, país y fecha, y consulta /organizations/public/stores', async () => {
      fetchSpy = mockFetch(200, rows)
      expect(await new StoreService().listStores()).toEqual(rows)
      expect(fetchSpy.mock.calls[0][0]).toBe('http://sass-back.test/api/v1/organizations/public/stores')
    })

    it('descarta filas mal formadas en vez de romper el sitemap', async () => {
      fetchSpy = mockFetch(200, [...rows, { slug: 5 }, null, 'x', { slug: 'sin-pais' }])
      expect(await new StoreService().listStores()).toEqual(rows)
    })

    it('cachea 10 min', async () => {
      fetchSpy = mockFetch(200, rows)
      const svc = new StoreService()
      await svc.listStores()
      await svc.listStores()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('si el sass-back cae sirve la última copia; sin copia da 503 (nunca una lista vacía)', async () => {
      fetchSpy = mockFetch(200, rows)
      const svc = new StoreService()
      const now = Date.now()
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now)
      await svc.listStores()
      nowSpy.mockReturnValue(now + 11 * 60_000)
      fetchSpy.mockRestore()
      fetchSpy = mockFetch(500, {})
      expect(await svc.listStores()).toEqual(rows)
      nowSpy.mockRestore()

      await expect(new StoreService().listStores()).rejects.toBeInstanceOf(ServiceUnavailableException)
    })
  })

  describe('organizationIsEnabled (ADR-021: no crear clientes en organizaciones inexistentes)', () => {
    const ORG_ID = '68546da0-041d-4929-b932-7af5d2576693'

    it('organización con ecommerce habilitado → true, y consulta por id', async () => {
      fetchSpy = mockFetch(200, { success: true, data: validStore });
      expect(await new StoreService().organizationIsEnabled(ORG_ID)).toBe(true)
      expect(fetchSpy.mock.calls[0][0]).toBe('http://sass-back.test/api/v1/organizations/public/by-id/' + ORG_ID)
    })

    it('404 → false (no existe)', async () => {
      fetchSpy = mockFetch(404, {})
      expect(await new StoreService().organizationIsEnabled(ORG_ID)).toBe(false)
    })

    it('ecommerce deshabilitado → false', async () => {
      fetchSpy = mockFetch(200, { success: true, data: { ...validStore, ecommerceEnabled: false } })
      expect(await new StoreService().organizationIsEnabled(ORG_ID)).toBe(false)
    })

    it('falla de infraestructura (5xx / red) → lanza 503, NO devuelve false', async () => {
      fetchSpy = mockFetch(500, {})
      await expect(new StoreService().organizationIsEnabled(ORG_ID)).rejects.toBeInstanceOf(ServiceUnavailableException)
      fetchSpy.mockRestore()
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
      await expect(new StoreService().organizationIsEnabled(ORG_ID)).rejects.toBeInstanceOf(ServiceUnavailableException)
    })

    it('cachea 60 s: dos chequeos seguidos → una sola consulta HTTP', async () => {
      fetchSpy = mockFetch(200, { success: true, data: validStore })
      const svc = new StoreService()
      await svc.organizationIsEnabled(ORG_ID)
      await svc.organizationIsEnabled(ORG_ID)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('caché (evita el 429 del sass-back en cada render)', () => {
    it('dos llamadas seguidas → una sola consulta HTTP', async () => {
      fetchSpy = mockFetch(200, validStore);
      const svc = new StoreService();
      await svc.resolveBySlug('mi-marca');
      await svc.resolveBySlug('mi-marca');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('llamadas simultáneas comparten la misma consulta', async () => {
      fetchSpy = mockFetch(200, validStore);
      const svc = new StoreService();
      await Promise.all([svc.resolveBySlug('mi-marca'), svc.resolveBySlug('mi-marca'), svc.resolveBySlug('mi-marca')]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('sass-back falla (429) con copia vieja → sirve la copia en vez de 503', async () => {
      fetchSpy = mockFetch(200, validStore);
      const svc = new StoreService();
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      await svc.resolveBySlug('mi-marca');

      nowSpy.mockReturnValue(now + 2 * 60_000); // la copia ya no es fresca, pero sí utilizable
      fetchSpy.mockRestore();
      fetchSpy = mockFetch(429, {});
      await expect(svc.resolveBySlug('mi-marca')).resolves.toMatchObject({ slug: 'mi-marca' });
      nowSpy.mockRestore();
    });

    it('sass-back falla y la copia es demasiado vieja → 503', async () => {
      fetchSpy = mockFetch(200, validStore);
      const svc = new StoreService();
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      await svc.resolveBySlug('mi-marca');

      nowSpy.mockReturnValue(now + 11 * 60_000);
      fetchSpy.mockRestore();
      fetchSpy = mockFetch(500, {});
      await expect(svc.resolveBySlug('mi-marca')).rejects.toBeInstanceOf(ServiceUnavailableException);
      nowSpy.mockRestore();
    });

    it('un 404 NUNCA se tapa con la copia: la tienda dejó de existir', async () => {
      fetchSpy = mockFetch(200, validStore);
      const svc = new StoreService();
      const now = Date.now();
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      await svc.resolveBySlug('mi-marca');

      nowSpy.mockReturnValue(now + 2 * 60_000);
      fetchSpy.mockRestore();
      fetchSpy = mockFetch(404, {});
      await expect(svc.resolveBySlug('mi-marca')).rejects.toBeInstanceOf(NotFoundException);
      nowSpy.mockRestore();
    });
  });
});
