import { createCustomerRouter } from './customer.router';
import type { TrpcContext } from '@/trpc/trpc';

const address = { street: 'Calle 1', city: 'Bogotá', postalCode: '110111', country: 'CO' };

function caller(headers: Record<string, string> = {}) {
  const checkout = jest.fn().mockResolvedValue({ id: 'order-1' });
  const router = createCustomerRouter({} as never, { checkout } as never, {} as never, {} as never, {} as never);
  const ctx: TrpcContext = {
    req: { headers } as never,
    uid: null, organizationId: 'org-1', role: null, userId: null,
    customerId: null,
    resolveCustomerId: async () => 'cust-1',
  };
  return { checkout, api: router.createCaller(ctx) };
}

describe('customer.checkout — país del visitante (ADR-014)', () => {
  it('toma el país de X-Visitor-Country y lo pasa al servicio', async () => {
    const { api, checkout } = caller({ 'x-visitor-country': 'co' });
    await api.checkout({ cartId: 'c1', shippingAddress: address });
    expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', customerId: 'cust-1', visitorCountryCode: 'CO' }));
  });

  it('sin X-Visitor-Country usa CF-IPCountry (Cloudflare)', async () => {
    const { api, checkout } = caller({ 'cf-ipcountry': 'BR' });
    await api.checkout({ cartId: 'c1', shippingAddress: address });
    expect(checkout.mock.calls[0]![0].visitorCountryCode).toBe('BR');
  });

  it('lo explícito en el input gana sobre los headers', async () => {
    const { api, checkout } = caller({ 'x-visitor-country': 'CO' });
    await api.checkout({ cartId: 'c1', shippingAddress: address, visitorCountryCode: 'mx' });
    expect(checkout.mock.calls[0]![0].visitorCountryCode).toBe('MX');
  });

  it('sin ninguna señal no manda país: el servicio usa el Market default', async () => {
    const { api, checkout } = caller();
    await api.checkout({ cartId: 'c1', shippingAddress: address });
    expect(checkout.mock.calls[0]![0].visitorCountryCode).toBeUndefined();
  });

  it('un valor inválido en el header se ignora (no 2 letras, o T1 de Tor en Cloudflare)', async () => {
    const { api, checkout } = caller({ 'x-visitor-country': 'ARG', 'cf-ipcountry': 'T1' });
    await api.checkout({ cartId: 'c1', shippingAddress: address });
    expect(checkout.mock.calls[0]![0].visitorCountryCode).toBeUndefined();
  });

  it('exige sesión de cliente: sin ella no llega al servicio', async () => {
    const checkout = jest.fn();
    const router = createCustomerRouter({} as never, { checkout } as never, {} as never, {} as never, {} as never);
    const api = router.createCaller({
      req: { headers: {} } as never, uid: null, organizationId: 'org-1', role: null, userId: null,
      customerId: null, resolveCustomerId: async () => null,
    });
    await expect(api.checkout({ cartId: 'c1', shippingAddress: address })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(checkout).not.toHaveBeenCalled();
  });
});
