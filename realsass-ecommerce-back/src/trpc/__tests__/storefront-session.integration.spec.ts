/**
 * Integración del storefront (ADR-023) contra el router tRPC REAL montado como en producción:
 * cookie-parser → rate limit → createExpressMiddleware(contexto con sesión firmada).
 *
 * Los repositorios son en memoria (no se toca ninguna base). Lo que se prueba es la regla del norte:
 * "nada que el cliente pueda fabricar es una credencial".
 */
import { randomUUID } from 'node:crypto';
import { Module, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { createRateLimitMiddleware } from '@real/auth-server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

import { CustomersService } from '@/customers/customers.service';
import { CustomerSessionService, CUSTOMER_SESSION_COOKIE } from '@/customers/customer-session.service';
import type { CustomerRecord, ICustomersRepository } from '@/customers/repository/customers.repository.interface';
import { CartService } from '@/cart/cart.service';
import type { CartRecord, ICartRepository } from '@/cart/repository/cart.repository.interface';
import { createEcommerceAppRouter } from '@/trpc/app-router';
import { createTrpcContextFactory } from '@/trpc/trpc';
import { IP_RATE_LIMIT } from '@/trpc/rate-limit.config';

// ─── Repositorios en memoria ───────────────────────────────────────────────

class InMemoryCustomers implements ICustomersRepository {
  readonly rows = new Map<string, CustomerRecord>();

  createGuest(organizationId: string): Promise<CustomerRecord> {
    const row: CustomerRecord = {
      id: randomUUID(), organizationId, email: `guest_${randomUUID()}@guest.local`,
      displayName: null, phone: null, isGuest: true, createdAt: new Date(), updatedAt: new Date(),
    };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }
  findById(organizationId: string, customerId: string): Promise<CustomerRecord | null> {
    const row = this.rows.get(customerId);
    return Promise.resolve(row && row.organizationId === organizationId ? row : null);
  }
  attachContact(organizationId: string, customerId: string, patch: { email?: string; displayName?: string; phone?: string }) {
    const row = this.rows.get(customerId)!;
    const email = patch.email?.trim().toLowerCase();
    const taken = email && [...this.rows.values()].some((c) => c.organizationId === organizationId && c.email === email && c.id !== customerId);
    if (email && !taken) row.email = email; // un email ya registrado se ignora en silencio
    if (patch.displayName) row.displayName = patch.displayName;
    if (patch.phone) row.phone = patch.phone;
    return Promise.resolve(row);
  }
  update(): Promise<CustomerRecord> { throw new Error('no usado'); }
  listByOrg(): Promise<{ items: CustomerRecord[]; total: number }> { return Promise.resolve({ items: [], total: 0 }); }
}

class InMemoryCarts implements ICartRepository {
  readonly rows = new Map<string, CartRecord>();

  private make(organizationId: string, sessionId: string): CartRecord {
    const cart: CartRecord = { id: randomUUID(), organizationId, sessionId, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), items: [] };
    this.rows.set(cart.id, cart);
    return cart;
  }
  findActiveBySession(organizationId: string, sessionId: string) {
    return Promise.resolve([...this.rows.values()].find((c) => c.organizationId === organizationId && c.sessionId === sessionId && c.status === 'ACTIVE') ?? null);
  }
  findById(organizationId: string, cartId: string) {
    const cart = this.rows.get(cartId);
    return Promise.resolve(cart && cart.organizationId === organizationId ? cart : null);
  }
  create(organizationId: string, sessionId: string) { return Promise.resolve(this.make(organizationId, sessionId)); }
  upsertItem(cartId: string, variantId: string, quantity: number) {
    const cart = this.rows.get(cartId)!;
    const existing = cart.items.find((i) => i.variantId === variantId);
    if (existing) existing.quantity += quantity;
    else cart.items.push({ id: randomUUID(), cartId, variantId, quantity } as CartRecord['items'][number]);
    return Promise.resolve(cart);
  }
  removeItem(cartId: string, variantId: string) {
    const cart = this.rows.get(cartId)!;
    cart.items = cart.items.filter((i) => i.variantId !== variantId);
    return Promise.resolve(cart);
  }
  complete(): Promise<void> { return Promise.resolve(); }
}

// ─── App de prueba ─────────────────────────────────────────────────────────

const ORG_A = '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b';
const ORG_B = '7a1c9d2e-8b3f-4c5d-a6e7-2f3a4b5c6d7e';
const VARIANT = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const SHIPPING = { street: 'Calle 1', city: 'Rosario', postalCode: '2000', country: 'AR' };

@Module({})
class EmptyModule {}

async function buildApp(opts: { rateLimit?: boolean } = {}) {
  const customersRepo = new InMemoryCustomers();
  const cartsRepo = new InMemoryCarts();
  const sessions = new CustomerSessionService();
  const customers = new CustomersService(customersRepo, sessions);
  const carts = new CartService(cartsRepo, { record: jest.fn() } as never);
  const orders = {
    checkout: jest.fn().mockResolvedValue({ id: 'order-1' }),
    listOrders: jest.fn().mockResolvedValue([]),
    getOrder: jest.fn().mockResolvedValue(null),
  };

  // Por defecto la tienda existe y está abierta; cada test puede cerrarla o simular que sass-back no responde.
  const gate = { assertStorefrontOpen: jest.fn().mockResolvedValue(undefined) };

  const router = createEcommerceAppRouter({
    catalogService: {} as never, inventoryService: {} as never, storeService: {} as never,
    ordersService: orders as never, customersService: customers, cartService: carts, customerSessions: sessions,
    storefrontGate: gate,
  });

  const moduleRef = await Test.createTestingModule({ imports: [EmptyModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  const handler = createExpressMiddleware({ router, createContext: createTrpcContextFactory(sessions) });
  if (opts.rateLimit) app.use('/trpc', createRateLimitMiddleware(IP_RATE_LIMIT), handler);
  else app.use('/trpc', handler);
  await app.init();

  const server = app.getHttpServer() as Parameters<typeof supertest>[0];
  return { app, server, sessions, orders, customersRepo, cartsRepo, gate };
}

type Built = Awaited<ReturnType<typeof buildApp>>;
const visitor = (b: Built) => supertest.agent(b.server); // cada agente = un navegador con su propia cookie jar
const query = (agent: ReturnType<typeof visitor>, path: string, input?: unknown, headers: Record<string, string> = {}) =>
  agent.get(`/trpc/${path}${input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(input))}`}`).set({ 'x-organization-id': ORG_A, ...headers });
const mutate = (agent: ReturnType<typeof visitor>, path: string, input?: unknown, headers: Record<string, string> = {}) =>
  agent.post(`/trpc/${path}`).set({ 'x-organization-id': ORG_A, ...headers }).send((input ?? {}) as object);
const errCode = (res: supertest.Response) => (res.body as { error?: { data?: { code?: string } } }).error?.data?.code;
const data = <T>(res: supertest.Response) => (res.body as { result: { data: T } }).result.data;

describe('storefront: sesión firmada, carritos y checkout (router tRPC real)', () => {
  let b: Built;
  beforeAll(() => { process.env['CUSTOMER_SESSION_SECRET'] = 'x'.repeat(48); });
  beforeEach(async () => { b = await buildApp(); });
  afterEach(async () => { await b.app.close(); });

  describe('identify', () => {
    it('entrega la sesión en una cookie HttpOnly + SameSite=Strict y NUNCA el token en el body', async () => {
      const res = await mutate(visitor(b), 'customer.identify', { organizationId: ORG_A });

      expect(res.status).toBe(200);
      const setCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${CUSTOMER_SESSION_COOKIE}=`))!;
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Strict/i);
      expect(setCookie).toMatch(/Path=\//);
      expect(JSON.stringify(res.body)).not.toContain('v1.'); // el token firmado no viaja en el body
      expect(Object.keys(data<Record<string, unknown>>(res))).toEqual(expect.arrayContaining(['customerId', 'isNew']));
      expect(data<Record<string, unknown>>(res)).not.toHaveProperty('token');
    });

    it('dos visitantes distintos son DOS clientes distintos (antes compartían el mismo invitado)', async () => {
      const a = data<{ customerId: string }>(await mutate(visitor(b), 'customer.identify', { organizationId: ORG_A }));
      const c = data<{ customerId: string }>(await mutate(visitor(b), 'customer.identify', { organizationId: ORG_A }));
      expect(a.customerId).not.toBe(c.customerId);
    });

    it('con su cookie, el mismo navegador continúa SU sesión (no crea otro cliente)', async () => {
      const browser = visitor(b);
      const first = data<{ customerId: string }>(await mutate(browser, 'customer.identify', { organizationId: ORG_A }));
      const again = data<{ customerId: string; isNew: boolean }>(await mutate(browser, 'customer.identify', { organizationId: ORG_A, displayName: 'Ana' }));
      expect(again.customerId).toBe(first.customerId);
      expect(again.isNew).toBe(false);
      expect(b.customersRepo.rows.size).toBe(1);
    });

    it('NO crea clientes para una tienda inexistente o pausada (identify crea filas: no se abusa con UUID inventados)', async () => {
      b.gate.assertStorefrontOpen.mockRejectedValueOnce(new NotFoundException('Tienda no encontrada'));

      const res = await mutate(visitor(b), 'customer.identify', { organizationId: ORG_A });

      expect(errCode(res)).toBe('NOT_FOUND');
      expect(b.gate.assertStorefrontOpen).toHaveBeenCalledWith(ORG_A);
      expect(b.customersRepo.rows.size).toBe(0);
      expect(res.headers['set-cookie']).toBeUndefined(); // tampoco se emite sesión
    });

    it('si sass-back no responde NO se asume que la tienda está abierta: 503 y no se crea nada', async () => {
      b.gate.assertStorefrontOpen.mockRejectedValueOnce(new ServiceUnavailableException('no disponible'));

      const res = await mutate(visitor(b), 'customer.identify', { organizationId: ORG_A });

      expect(errCode(res)).toBe('SERVICE_UNAVAILABLE');
      expect(b.customersRepo.rows.size).toBe(0);
    });

    it('saber el email de otro NO da su cuenta: se crea un cliente propio y el email ajeno se ignora', async () => {
      const ana = visitor(b);
      const anaId = data<{ customerId: string }>(await mutate(ana, 'customer.identify', { organizationId: ORG_A, email: 'ana@ejemplo.com' })).customerId;

      const intruso = visitor(b);
      const intrusoId = data<{ customerId: string }>(await mutate(intruso, 'customer.identify', { organizationId: ORG_A, email: 'ana@ejemplo.com' })).customerId;

      expect(intrusoId).not.toBe(anaId);
      expect(data<{ email: string }>(await query(intruso, 'customer.me')).email).toMatch(/@guest\.local$/);
      expect(data<{ email: string }>(await query(ana, 'customer.me')).email).toBe('ana@ejemplo.com');
    });
  });

  describe('lo que fabrica el cliente no es una credencial', () => {
    it('sin cookie: customer.me => UNAUTHORIZED', async () => {
      expect(errCode(await query(visitor(b), 'customer.me'))).toBe('UNAUTHORIZED');
    });

    it('un x-customer-id conocido (el esquema viejo) NO sirve: UNAUTHORIZED', async () => {
      const victima = data<{ customerId: string }>(await mutate(visitor(b), 'customer.identify', { organizationId: ORG_A })).customerId;
      const atacante = visitor(b);

      for (const header of ['x-customer-id', 'x-customer-token']) {
        const res = await query(atacante, 'customer.me', undefined, { [header]: victima });
        expect(errCode(res)).toBe('UNAUTHORIZED');
      }
    });

    it('cookie alterada o inventada => UNAUTHORIZED', async () => {
      const browser = visitor(b);
      const res = await mutate(browser, 'customer.identify', { organizationId: ORG_A });
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      const [name, token] = [cookie.slice(0, cookie.indexOf('=')), cookie.slice(cookie.indexOf('=') + 1)];

      const tampered = `${name}=${token.slice(0, -4)}AAAA`;
      expect(errCode(await query(supertest.agent(b.server), 'customer.me', undefined, { Cookie: tampered }))).toBe('UNAUTHORIZED');
      expect(errCode(await query(supertest.agent(b.server), 'customer.me', undefined, { Cookie: `${name}=v1.e30.firma` }))).toBe('UNAUTHORIZED');
    });

    it('una sesión de la tienda A NO sirve en la tienda B (FORBIDDEN)', async () => {
      const browser = visitor(b);
      await mutate(browser, 'customer.identify', { organizationId: ORG_A });

      expect(errCode(await query(browser, 'customer.me', undefined, { 'x-organization-id': ORG_B }))).toBe('FORBIDDEN');
      expect(errCode(await query(browser, 'customer.me'))).toBeUndefined(); // en la suya sí funciona
    });

    it('logout borra la cookie', async () => {
      const res = await mutate(visitor(b), 'customer.logout');
      expect(res.status).toBe(200);
      const cleared = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${CUSTOMER_SESSION_COOKIE}=`))!;
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
  });

  describe('carrito: solo el dueño lo ve y lo opera', () => {
    async function conCarrito() {
      const ana = visitor(b);
      await mutate(ana, 'customer.identify', { organizationId: ORG_A });
      const cartId = data<{ id: string }>(await mutate(ana, 'customer.cart.addItem', { variantId: VARIANT, quantity: 2 })).id;
      const intruso = visitor(b);
      await mutate(intruso, 'customer.identify', { organizationId: ORG_A });
      return { ana, intruso, cartId };
    }

    it('el dueño ve su carrito', async () => {
      const { ana, cartId } = await conCarrito();
      expect(data<{ id: string }>(await query(ana, 'customer.cart.get', { cartId })).id).toBe(cartId);
    });

    it('otro cliente NO puede leerlo, modificarlo, vaciarlo ni pagarlo (mismo NOT_FOUND que si no existiera)', async () => {
      const { intruso, cartId } = await conCarrito();

      expect(errCode(await query(intruso, 'customer.cart.get', { cartId }))).toBe('NOT_FOUND');
      expect(errCode(await mutate(intruso, 'customer.cart.addItem', { variantId: VARIANT, quantity: 1, cartId }))).toBe('NOT_FOUND');
      expect(errCode(await mutate(intruso, 'customer.cart.removeItem', { cartId, variantId: VARIANT }))).toBe('NOT_FOUND');
      expect(errCode(await mutate(intruso, 'customer.checkout', { cartId, shippingAddress: SHIPPING }))).toBe('NOT_FOUND');
      expect(b.orders.checkout).not.toHaveBeenCalled();
      expect(b.cartsRepo.rows.get(cartId)!.items[0]!.quantity).toBe(2); // intacto
    });

    it('el sessionId que manda el cliente se ignora: el carrito se ata al customerId de la sesión', async () => {
      const ana = visitor(b);
      const anaId = data<{ customerId: string }>(await mutate(ana, 'customer.identify', { organizationId: ORG_A })).customerId;
      const cartId = data<{ id: string }>(await mutate(ana, 'customer.cart.addItem', { variantId: VARIANT, quantity: 1, sessionId: 'sess_robada' })).id;
      expect(b.cartsRepo.rows.get(cartId)!.sessionId).toBe(anaId);
    });

    it('el dueño sí puede pagar su carrito, y el checkout recibe SU customerId (no uno del body)', async () => {
      const { ana, cartId } = await conCarrito();
      const res = await mutate(ana, 'customer.checkout', { cartId, shippingAddress: SHIPPING });

      expect(res.status).toBe(200);
      expect(b.orders.checkout).toHaveBeenCalledWith(expect.objectContaining({ cartId, organizationId: ORG_A, customerId: data<{ customerId: string }>(await mutate(ana, 'customer.identify', { organizationId: ORG_A })).customerId }));
    });
  });
});

describe('storefront: rate limit de /trpc', () => {
  beforeAll(() => { process.env['CUSTOMER_SESSION_SECRET'] = 'x'.repeat(48); });

  it('identify se corta con 429 + Retry-After a partir del 11.º intento por IP', async () => {
    const b = await buildApp({ rateLimit: true });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) statuses.push((await mutate(visitor(b), 'customer.identify', { organizationId: ORG_A })).status);
      expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
      expect(statuses[10]).toBe(429);

      const blocked = await mutate(visitor(b), 'customer.identify', { organizationId: ORG_A });
      expect(blocked.headers['retry-after']).toBe('60');
      // el resto del tráfico de esa IP (otro procedure) sigue pasando: la regla estricta es por procedure
      expect((await query(visitor(b), 'customer.me')).status).not.toBe(429);
    } finally { await b.app.close(); }
  });
});
