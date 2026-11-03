/**
 * access-matrix.spec.ts — contrato de AUTORIZACIÓN de todo el appRouter del ecommerce-back (tRPC).
 *
 * Para CADA procedure se prueba, con los servicios simulados, qué responde a cinco llamantes:
 *   anon      visitante del storefront sin sesión (con x-organization-id)
 *   noOrg     admin con sesión pero sin organización
 *   customer  cliente del storefront con sesión verificada
 *   collab    COLABORADOR del dashboard
 *   owner     DUEÑO del dashboard
 * Se llama con input `undefined`: la autorización corre ANTES de validar el input (B = pasó la autorización y falló
 * el input; U/F = rechazado; O = ejecutó). Es un contrato congelado: cambiar la protección de un procedure, o agregar
 * uno sin clasificar, hace fallar este test. Un cambio de este archivo es un cambio de seguridad.
 */
import { TRPCError } from '@trpc/server';
import { createEcommerceAppRouter } from './app-router';

const service = () => new Proxy({}, { get: () => jest.fn().mockResolvedValue(undefined) });
const deps = new Proxy({}, { get: () => service() }) as never;
const appRouter = createEcommerceAppRouter(deps);

/** Busca "router.procedure" en el caller sin tipar a ciegas: cada paso se comprueba. */
function procedureOf(caller: object, path: string): (input: undefined) => Promise<unknown> {
  let node: unknown = caller;
  for (const key of path.split('.')) {
    if ((typeof node !== 'object' && typeof node !== 'function') || node === null) throw new Error(`ruta inválida: ${path}`);
    node = Reflect.get(node, key);
  }
  if (typeof node !== 'function') throw new Error(`no es un procedure: ${path}`);
  const fn = node;
  return (input) => Reflect.apply(fn, undefined, [input]);
}

const codeOf = (e: unknown): string => (e instanceof TRPCError ? e.code : 'UNKNOWN');

const base = { req: { headers: {}, cookies: {} }, userId: null, customerId: null };
const CALLERS = {
  anon: { ...base, uid: null, organizationId: 'o', role: null, resolveCustomerId: async () => null },
  noOrg: { ...base, uid: 'u', organizationId: null, role: null, resolveCustomerId: async () => null },
  customer: { ...base, uid: null, organizationId: 'o', role: null, resolveCustomerId: async () => 'c1' },
  collab: { ...base, uid: 'u', organizationId: 'o', role: 'COLLABORATOR', resolveCustomerId: async () => null },
  owner: { ...base, uid: 'u', organizationId: 'o', role: 'OWNER', resolveCustomerId: async () => null },
} as const;

const CODE: Record<string, string> = { UNAUTHORIZED: 'U', BAD_REQUEST: 'B', FORBIDDEN: 'F', NOT_FOUND: 'N' };
const U = 'U';
const B = 'B';
const O = 'O';
/** anon noOrg customer collab owner */
const CONTRACT: Record<string, string[]> = {
  'adminCatalog.create': [U, B, U, B, B],
  'adminCatalog.list': [U, B, U, O, O],
  'adminCatalog.update': [U, B, U, B, B],
  'adminInventory.setStock': [U, B, U, B, B],
  'adminOrders.get': [U, B, U, B, B],
  'adminOrders.list': [U, B, U, O, O],
  'customer.cart.addItem': [U, B, B, U, U],
  'customer.cart.get': [U, B, B, U, U],
  'customer.cart.removeItem': [U, B, B, U, U],
  'customer.checkout': [U, B, B, U, U],
  'customer.deleteAccount': [U, B, O, U, U], // solo el propio cliente
  'customer.getProduct': [B, B, B, B, B], // público (catálogo del storefront)
  'customer.getProducts': [B, B, B, B, B], // público
  'customer.listStores': [O, O, O, O, O], // público (sitemap)
  'customer.me': [U, B, O, U, U],
  'customer.orderDetail': [U, B, B, U, U],
  'customer.orders': [U, B, O, U, U],
  'customer.resolveStore': [B, B, B, B, B], // público
};

async function probe(path: string, ctx: (typeof CALLERS)[keyof typeof CALLERS]): Promise<string> {
  const fn = procedureOf(appRouter.createCaller(ctx), path);
  try {
    await fn(undefined);
    return 'O';
  } catch (e) {
    const code = codeOf(e);
    return CODE[code] ?? code;
  }
}

describe('matriz de acceso del appRouter (ecommerce-back)', () => {
  const paths = Object.keys(appRouter._def.procedures).sort();

  it('todo procedure está clasificado en el contrato (y no sobran entradas)', () => {
    expect(paths).toEqual(Object.keys(CONTRACT).sort());
  });

  it.each(paths)('%s', async (path) => {
    const got = await Promise.all(Object.values(CALLERS).map((c) => probe(path, c)));
    expect(got).toEqual(CONTRACT[path]);
  });

  it('invariante: un cliente del storefront NUNCA ejecuta procedures de administración', async () => {
    for (const path of paths.filter((p) => p.startsWith('admin'))) {
      expect(await probe(path, CALLERS.customer)).toBe('U');
    }
  });

  it('invariante: un admin NUNCA actúa como cliente (los procedures de cliente exigen sesión de cliente)', async () => {
    const protectedCustomer = paths.filter((p) => /^customer\.(cart|checkout|me|orderDetail|orders)/.test(p));
    expect(protectedCustomer.length).toBeGreaterThan(5);
    for (const path of protectedCustomer) {
      expect(await probe(path, CALLERS.owner)).toBe('U');
      expect(await probe(path, CALLERS.anon)).toBe('U');
    }
  });
});
