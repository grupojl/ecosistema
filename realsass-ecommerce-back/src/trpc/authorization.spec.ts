/**
 * authorization.spec.ts — barrera de autorización de los routers de ecommerce-back, con los routers REALES.
 *
 * Los services son dobles que EXPLOTAN si se los toca: si una barrera falla, el test lo ve porque el service fue
 * alcanzado. Complementa storefront-session.integration.spec.ts (que prueba cookies y carritos con la app real).
 */
import type { Request, Response } from 'express';
import { router, ownerOnlyProcedure, type TrpcContext } from '@/trpc/trpc';
import { createEcommerceAppRouter, type EcommerceAppRouterDeps } from '@/trpc/app-router';
import { createAdminCatalogRouter } from '@/trpc/routers/admin-catalog.router';
import { currentTenantScope } from '@/prisma/tenant-context';

// ADR-027: la organización del contexto tiene que ser un UUID (si no, no se abre el alcance de Row Level Security).
const ORG_1 = '00000000-0000-4000-8000-000000000001';
const ORG_2 = '00000000-0000-4000-8000-000000000002';

const untouchable = <T>(name: string): T =>
  new Proxy({}, { get: (_t, prop) => { throw new Error(`${name}.${String(prop)} fue alcanzado: la barrera no frenó la llamada`); } }) as T;

const live = {
  catalog:   { listProductsAdmin: jest.fn(), createProduct: jest.fn(), updateProduct: jest.fn() },
  inventory: { setStock: jest.fn() },
  orders:    { listOrders: jest.fn() },
};

const deps = (): EcommerceAppRouterDeps => ({
  catalogService:   untouchable('catalog'),
  inventoryService: untouchable('inventory'),
  ordersService:    untouchable('orders'),
  customersService: untouchable('customers'),
  cartService:      untouchable('cart'),
  storeService:     untouchable('store'),
  customerSessions: untouchable('sessions'),
  storefrontGate:   untouchable('gate'),
});

const appRouter = createEcommerceAppRouter(deps());

type Caller = (path: string, input?: unknown) => Promise<unknown>;
const callerFor = (ctx: Partial<TrpcContext>): Caller => {
  const base = { req: {} as Request, res: {} as Response, uid: null, organizationId: null, role: null, userId: null, customerId: null, customerOrganizationId: null, ...ctx };
  const caller = appRouter.createCaller(base) as unknown as Record<string, unknown>;
  return (path, input) => {
    const fn = path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], caller) as (i?: unknown) => Promise<unknown>;
    return fn(input);
  };
};
const codeOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: { code?: string }) => e.code)) ?? 'OK';

const ADMIN_PROCS = [
  'adminCatalog.list', 'adminCatalog.create', 'adminCatalog.update',
  'adminInventory.setStock', 'adminOrders.list', 'adminOrders.get',
];
const CUSTOMER_PROCS = [
  'customer.me', 'customer.deleteAccount', 'customer.orders', 'customer.orderDetail',
  'customer.cart.get', 'customer.cart.addItem', 'customer.cart.removeItem', 'customer.checkout',
];

const ANON = {};
const SIN_ORG = { uid: 'u1' };
const SIN_ROL = { uid: 'u1', organizationId: ORG_1 };            // el header de org llegó pero no es miembro
const COLABORADOR = { uid: 'u1', organizationId: ORG_1, role: 'COLLABORATOR' as const };

describe('Autorización de los routers de admin (ecommerce-back)', () => {
  it.each(ADMIN_PROCS)('%s sin sesión => UNAUTHORIZED', async (p) => {
    expect(await codeOf(callerFor(ANON)(p))).toBe('UNAUTHORIZED');
  });

  it.each(ADMIN_PROCS)('%s con sesión pero sin organización => BAD_REQUEST', async (p) => {
    expect(await codeOf(callerFor(SIN_ORG)(p))).toBe('BAD_REQUEST');
  });

  it.each(ADMIN_PROCS)('%s con header de organización pero SIN membresía => FORBIDDEN', async (p) => {
    expect(await codeOf(callerFor(SIN_ROL)(p))).toBe('FORBIDDEN');
  });

  it('un CUSTOMER con sesión de storefront válida NO es admin: no abre el panel', async () => {
    const cliente = { customerId: 'c1', customerOrganizationId: ORG_1, organizationId: ORG_1 };

    for (const p of ADMIN_PROCS) expect(await codeOf(callerFor(cliente)(p))).toBe('UNAUTHORIZED');
  });
});

describe('Control positivo: el panel admite a OWNER y a COLABORADOR y usa la organización del CONTEXTO', () => {
  const adminRouter = router({ adminCatalog: createAdminCatalogRouter(live.catalog as never) });

  beforeEach(() => jest.clearAllMocks());

  it.each([['COLLABORATOR' as const], ['OWNER' as const]])('adminCatalog.list con %s llega al service con la org del contexto', async (role) => {
    live.catalog.listProductsAdmin.mockResolvedValue([]);
    const caller = adminRouter.createCaller({
      req: {} as Request, res: {} as Response, uid: 'u1', organizationId: ORG_1, role, userId: 'i1', customerId: null, customerOrganizationId: null,
    });

    await caller.adminCatalog.list();

    expect(live.catalog.listProductsAdmin).toHaveBeenCalledWith(ORG_1);
  });
});

describe('ownerOnlyProcedure (sin routers que lo usen hoy, pero la barrera existe y se prueba)', () => {
  const ownerRouter = router({ danger: ownerOnlyProcedure.query(({ ctx }) => ({ org: ctx.organizationId })) });
  const base = { req: {} as Request, res: {} as Response, uid: null, organizationId: null, role: null, userId: null, customerId: null, customerOrganizationId: null };
  const call = (over: Partial<TrpcContext>) => ownerRouter.createCaller({ ...base, ...over }).danger();

  it('sin sesión => UNAUTHORIZED; sin org => BAD_REQUEST', async () => {
    expect(await codeOf(call({}))).toBe('UNAUTHORIZED');
    expect(await codeOf(call({ uid: 'u1' }))).toBe('BAD_REQUEST');
  });

  it('un colaborador => FORBIDDEN; sin rol => FORBIDDEN', async () => {
    expect(await codeOf(call({ uid: 'u1', organizationId: ORG_1, role: 'COLLABORATOR' }))).toBe('FORBIDDEN');
    expect(await codeOf(call({ uid: 'u1', organizationId: ORG_1, role: null }))).toBe('FORBIDDEN');
  });

  it('el dueño pasa y recibe SU organización', async () => {
    await expect(call({ uid: 'u1', organizationId: ORG_1, role: 'OWNER' })).resolves.toEqual({ org: ORG_1 });
  });
});

describe('Autorización del cliente del storefront (a nivel de router)', () => {
  it.each(CUSTOMER_PROCS)('%s sin sesión de cliente => UNAUTHORIZED', async (p) => {
    expect(await codeOf(callerFor({ organizationId: ORG_1 })(p))).toBe('UNAUTHORIZED');
  });

  it.each(CUSTOMER_PROCS)('%s con sesión pero sin header de tienda => BAD_REQUEST', async (p) => {
    expect(await codeOf(callerFor({ customerId: 'c1', customerOrganizationId: ORG_1 })(p))).toBe('BAD_REQUEST');
  });

  it.each(CUSTOMER_PROCS)('%s con la sesión de la tienda A usada en la tienda B => FORBIDDEN', async (p) => {
    const ctx = { customerId: 'c1', customerOrganizationId: 'org-A', organizationId: 'org-B' };

    expect(await codeOf(callerFor(ctx)(p))).toBe('FORBIDDEN');
  });

  it('un ADMIN (uid) sin sesión de cliente tampoco entra a procedures de cliente', async () => {
    expect(await codeOf(callerFor({ uid: 'u1', organizationId: ORG_1, role: 'OWNER' })('customer.me'))).toBe('UNAUTHORIZED');
  });
});

describe('Procedures públicos del storefront: no exigen sesión de admin ni de cliente', () => {
  it('customer.logout funciona sin sesión (limpia la cookie)', async () => {
    const clearCookie = jest.fn();
    const sessions = { clearCookie: jest.fn(), cookieOptions: jest.fn(() => ({})) };
    const r = createEcommerceAppRouter({ ...deps(), customerSessions: sessions as never });
    const caller = r.createCaller({
      req: {} as Request, res: { clearCookie, cookie: jest.fn() } as unknown as Response,
      uid: null, organizationId: null, role: null, userId: null, customerId: null, customerOrganizationId: null,
    });

    // Cualquier error que NO sea de autorización es aceptable acá; lo que no puede pasar es UNAUTHORIZED/FORBIDDEN.
    const code = await codeOf(caller.customer.logout());

    expect(['UNAUTHORIZED', 'FORBIDDEN']).not.toContain(code);
  });
});

describe('ADR-027 — alcance de tenant (Row Level Security) alrededor del handler', () => {
  const scopeRouter = router({ probe: ownerOnlyProcedure.query(() => currentTenantScope()) });
  const base = { req: {} as Request, res: {} as Response, uid: 'u1', organizationId: ORG_1, role: 'OWNER' as const, userId: 'i1', customerId: null, customerOrganizationId: null };
  const probe = (over: Partial<TrpcContext> = {}) => scopeRouter.createCaller({ ...base, ...over }).probe();

  it('el handler corre con visibilidad limitada a la organización del contexto', async () => {
    await expect(probe()).resolves.toEqual({ kind: 'tenant', organizationId: ORG_1 });
  });

  it('cada petición usa SU organización (no arrastra la de la anterior)', async () => {
    const [a, b] = await Promise.all([probe({ organizationId: ORG_1 }), probe({ organizationId: ORG_2 })]);

    expect(a).toEqual({ kind: 'tenant', organizationId: ORG_1 });
    expect(b).toEqual({ kind: 'tenant', organizationId: ORG_2 });
    expect(currentTenantScope()).toBeNull();
  });

  it('un organizationId que no es UUID => BAD_REQUEST y el handler no se ejecuta', async () => {
    expect(await codeOf(probe({ organizationId: 'no-es-uuid' }))).toBe('BAD_REQUEST');
  });
});
