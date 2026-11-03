import { of, lastValueFrom } from 'rxjs';
import { createCustomerRouter } from './customer.router';
import { router } from '@/trpc';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { LoggingOutboxPublisher } from '@/outbox/logging-outbox.publisher';

const ORG = '6f1c2a3b-0000-4000-8000-000000000001';
const VARIANT = '6f1c2a3b-0000-4000-8000-0000000000aa';
const ORDER = '6f1c2a3b-0000-4000-8000-0000000000bb';

const make = () => {
  const customers = { findById: jest.fn(), anonymize: jest.fn() };
  const orders = { listByCustomer: jest.fn(), getOrder: jest.fn(), checkout: jest.fn() };
  const cart = { getCart: jest.fn(), addItem: jest.fn(), removeItem: jest.fn() };
  const catalog = { listProductsPublic: jest.fn(), getProductPublic: jest.fn() };
  const store = { listStores: jest.fn() };
  const r = router({ customer: createCustomerRouter(customers as never, orders as never, cart as never, catalog as never, store as never) });
  const base = { userId: null, uid: null, role: null, resolveCustomerId: async () => 'c1' };
  const caller = (headers: Record<string, string> = {}) =>
    r.createCaller({ ...base, req: { headers }, organizationId: ORG, customerId: null } as never).customer;
  return { caller, customers, orders, cart, catalog, store };
};

describe('customer.* (público)', () => {
  it('listStores, getProducts y getProduct delegan; un producto inexistente es NOT_FOUND', async () => {
    const { caller, store, catalog } = make();
    store.listStores.mockResolvedValue([{ slug: 'a' }]);
    catalog.listProductsPublic.mockResolvedValue([1]);
    catalog.getProductPublic.mockResolvedValueOnce({ id: 'p' }).mockResolvedValueOnce(null);
    const c = caller();
    expect(await c.listStores()).toEqual([{ slug: 'a' }]);
    expect(await c.getProducts({ organizationId: ORG, category: 'calzado' })).toEqual([1]);
    expect(catalog.listProductsPublic).toHaveBeenCalledWith(ORG, 'calzado');
    expect(await c.getProduct({ organizationId: ORG, handle: 'x' })).toEqual({ id: 'p' });
    await expect(c.getProduct({ organizationId: ORG, handle: 'fantasma' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('customer.* (autenticado: el id del cliente sale de la sesión, nunca del input)', () => {
  it('me, orders y deleteAccount usan el cliente de la sesión', async () => {
    const { caller, customers, orders } = make();
    customers.findById.mockResolvedValue({ id: 'c1' });
    orders.listByCustomer.mockResolvedValue([]);
    customers.anonymize.mockResolvedValue({ ok: true });
    const c = caller();
    await c.me();
    await c.orders();
    await c.deleteAccount();
    expect(customers.findById).toHaveBeenCalledWith(ORG, 'c1');
    expect(orders.listByCustomer).toHaveBeenCalledWith(ORG, 'c1');
    expect(customers.anonymize).toHaveBeenCalledWith(ORG, 'c1');
  });

  it('orderDetail: una orden de OTRO cliente (o inexistente) es NOT_FOUND, igual que si no existiera', async () => {
    const { caller, orders } = make();
    orders.getOrder.mockResolvedValueOnce({ id: ORDER, customerId: 'otro' }).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: ORDER, customerId: 'c1' });
    const c = caller();
    await expect(c.orderDetail({ orderId: ORDER })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(c.orderDetail({ orderId: ORDER })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await c.orderDetail({ orderId: ORDER })).toMatchObject({ id: ORDER });
  });

  it('carrito: get, addItem y removeItem pasan organización y cliente de la sesión', async () => {
    const { caller, cart } = make();
    const c = caller();
    await c.cart.get({ cartId: 'cart-1' });
    await c.cart.addItem({ variantId: VARIANT, quantity: 2, sessionId: 's1', cartId: 'cart-1' });
    await c.cart.removeItem({ cartId: 'cart-1', variantId: VARIANT });
    expect(cart.getCart).toHaveBeenCalledWith(ORG, 'cart-1', 'c1');
    expect(cart.addItem).toHaveBeenCalledWith(ORG, 's1', VARIANT, 2, 'cart-1', 'c1');
    expect(cart.removeItem).toHaveBeenCalledWith(ORG, 'cart-1', VARIANT, 'c1');
  });

  it('addItem rechaza cantidades no positivas o fraccionarias', async () => {
    const { caller } = make();
    await expect(caller().cart.addItem({ variantId: VARIANT, quantity: 0, sessionId: 's' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller().cart.addItem({ variantId: VARIANT, quantity: 1.5, sessionId: 's' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('checkout: el país del visitante explícito gana; si no, el del header; y el cliente es el de la sesión', async () => {
    const { caller, orders } = make();
    const address = { street: 'Calle 1', city: 'Rosario', postalCode: '2000', country: 'AR' };
    await caller({ 'cf-ipcountry': 'BR' }).checkout({ cartId: 'cart-1', shippingAddress: address, locale: 'es' });
    expect(orders.checkout).toHaveBeenLastCalledWith(expect.objectContaining({ organizationId: ORG, customerId: 'c1', visitorCountryCode: 'BR', locale: 'es' }));
    await caller({ 'cf-ipcountry': 'BR' }).checkout({ cartId: 'cart-1', shippingAddress: address, visitorCountryCode: 'mx' });
    expect(orders.checkout).toHaveBeenLastCalledWith(expect.objectContaining({ visitorCountryCode: 'MX' }));
    await caller().checkout({ cartId: 'cart-1', shippingAddress: address });
    expect(orders.checkout).toHaveBeenLastCalledWith(expect.objectContaining({ visitorCountryCode: undefined }));
  });

  it('checkout valida la dirección y el costo de envío', async () => {
    const { caller } = make();
    await expect(caller().checkout({ cartId: 'c', shippingAddress: { street: 'x' } as never })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller().checkout({ cartId: 'c', shippingAddress: { street: 's', city: 'c', postalCode: 'p', country: 'AR' }, shippingCents: -1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('ResponseInterceptor y LoggingOutboxPublisher', () => {
  it('el interceptor envuelve la respuesta en { success, data }', async () => {
    const out = await lastValueFrom(new ResponseInterceptor().intercept({} as never, { handle: () => of({ a: 1 }) }));
    expect(out).toEqual({ success: true, data: { a: 1 } });
  });

  it('el publisher por defecto solo registra el evento (sin datos personales) y no falla', async () => {
    await expect(
      new LoggingOutboxPublisher().publish({ id: 'e1', organizationId: 'o', aggregateType: 'Order', aggregateId: 'a', type: 'order.created', payload: { email: 'x@y.com' }, attempts: 0, createdAt: new Date() }),
    ).resolves.toBeUndefined();
  });
});
