/**
 * cross-tenant.spec.ts — aislamiento entre organizaciones en el ecommerce-back (carrito, órdenes, clientes, stock).
 *
 * Parte 1 (siempre corre): cada repositorio Prisma tiene que estar ejercitado en `repositories.integration.spec.ts`,
 * que es donde vive el caso "otra organización no ve ni toca lo mío aunque conozca el id".
 * Parte 2 (Postgres real; se omite sin TEST_DATABASE_URL *_test): el flujo de SERVICIO, no solo el repositorio —
 * una organización no puede pagar el carrito de otra, ni leer sus órdenes, ni gastar su stock.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaCartRepository } from '@/cart/repository/prisma-cart.repository';
import { PrismaCatalogRepository } from '@/catalog/repository/prisma-catalog.repository';
import { PrismaCustomersRepository } from '@/customers/repository/prisma-customers.repository';
import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';
import { InventoryService } from '@/inventory/inventory.service';
import { OrdersService } from '@/orders/orders.service';

const SRC = join(__dirname, '..');
const integration = readFileSync(join(__dirname, 'repositories.integration.spec.ts'), 'utf8');

const repositories = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => {
    const dir = join(SRC, d.name, 'repository');
    try {
      return readdirSync(dir)
        .filter((f) => /^prisma-.*\.repository\.ts$/.test(f))
        .map((f) => ({ file: `${d.name}/repository/${f}`, cls: /export class (\w+)/.exec(readFileSync(join(dir, f), 'utf8'))?.[1] }));
    } catch {
      return [];
    }
  });

describe('cross-tenant — cobertura de aislamiento', () => {
  it('hay repositorios que cubrir', () => {
    expect(repositories.length).toBeGreaterThanOrEqual(5);
  });

  it.each(repositories)('$file está ejercitado en la suite de integración con 2 organizaciones', ({ cls }) => {
    expect(cls).toBeDefined();
    expect(integration).toContain(`new ${cls}(`);
  });

  it('la suite de integración declara el invariante', () => {
    expect(integration).toMatch(/nunca lee ni modifica lo de otra/);
  });
});

const url = process.env['TEST_DATABASE_URL'];
const enabled = !!url && /_test(\?|$)/.test(url);
const suite = enabled ? describe : describe.skip;

suite('cross-tenant — flujo de servicio contra Postgres real', () => {
  let prisma: PrismaService;
  let orders: OrdersService;
  const run = randomUUID().slice(0, 8);
  const orgA = `xt-a-${run}`;
  const orgB = `xt-b-${run}`;
  let customerA: string;
  let customerB: string;
  let variantB: string;
  let cartB: string;
  let orderB: string;

  const inventory = () => new PrismaInventoryRepository(prisma);

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url;
    prisma = new PrismaService();
    await prisma.onModuleInit();

    const productB = await new PrismaCatalogRepository(prisma).createProduct(orgB, {
      name: 'Solo de B', handle: 'solo-b', description: 'd',
      variants: [{ sku: `sku-b-${run}`, title: 'Único', priceCents: 500, currency: 'ARS' }],
    });
    variantB = productB.variants[0]!.id;
    await inventory().setAvailable(orgB, variantB, 5);

    const customers = new PrismaCustomersRepository(prisma);
    customerA = (await customers.upsertByEmail(orgA, 'a@x.com', {})).customer.id;
    customerB = (await customers.upsertByEmail(orgB, 'b@x.com', {})).customer.id;

    const carts = new PrismaCartRepository(prisma);
    cartB = (await carts.create(orgB, `s-${randomUUID()}`, customerB)).id;
    await carts.upsertItem(orgB, cartB, variantB, 2);

    const market = { id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} };
    orders = new OrdersService(
      prisma,
      new PrismaOrdersRepository(prisma),
      new InventoryService(prisma, inventory()),
      { track: jest.fn() } as never,
      { resolveMarket: jest.fn().mockResolvedValue(market) } as never,
      { enabled: false } as never,
    );
    orderB = (await orders.checkout({ organizationId: orgB, cartId: cartB, customerId: customerB, shippingAddress: { l: 1 } })).id;
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.order.deleteMany({ where: { organizationId: org } });
      await prisma.cart.deleteMany({ where: { organizationId: org } });
      await prisma.storeCustomer.deleteMany({ where: { organizationId: org } });
      await prisma.product.deleteMany({ where: { organizationId: org } });
    }
    await prisma.onModuleDestroy();
  });

  it('org A no puede hacer checkout con el carrito de org B (ni siquiera con un cliente propio)', async () => {
    const carts = new PrismaCartRepository(prisma);
    const otherCart = (await carts.create(orgB, `s-${randomUUID()}`, customerB)).id;
    await carts.upsertItem(orgB, otherCart, variantB, 1);
    const before = await inventory().findByVariant(orgB, variantB);

    await expect(
      orders.checkout({ organizationId: orgA, cartId: otherCart, customerId: customerA, shippingAddress: { l: 1 } }),
    ).rejects.toThrow(/Carrito vacío o no encontrado/);

    expect(await inventory().findByVariant(orgB, variantB)).toEqual(before); // su stock no se movió
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: otherCart } })).status).toBe('ACTIVE');
  });

  it('org A no ve las órdenes de org B por id, por cliente ni por listado', async () => {
    await expect(orders.findById(orgA, orderB)).rejects.toThrow(/no encontrada/); // 404, no 403: no revela que existe
    expect(await orders.getOrder(orgA, orderB)).toBeNull();
    expect(await orders.listByCustomer(orgA, customerB)).toEqual([]);
    expect((await orders.listOrders(orgA)).every((o) => o.organizationId === orgA)).toBe(true);
    expect((await orders.findById(orgB, orderB))?.organizationId).toBe(orgB); // control: B sí la ve
  });

  it('org A no puede cambiar el estado ni el paymentIntent de una orden de B', async () => {
    await expect(orders.updateStatus(orgA, orderB, 'PAID')).rejects.toThrow();
    await expect(orders.setPaymentIntent(orgA, orderB, 'pi_ajeno')).rejects.toThrow();
    const row = await prisma.order.findUniqueOrThrow({ where: { id: orderB } });
    expect(row).toMatchObject({ status: 'PENDING_PAYMENT', paymentIntentId: null });
  });

  it('forTenant(A) no devuelve filas de B en ningún modelo con tenant', async () => {
    const a = prisma.forTenant(orgA);
    expect(await a.order.findMany({ where: { id: orderB } })).toEqual([]);
    expect(await a.cart.findMany({ where: { id: cartB } })).toEqual([]);
    expect(await a.storeCustomer.findMany({ where: { id: customerB } })).toEqual([]);
    expect(await a.inventoryItem.findMany({ where: { variantId: variantB } })).toEqual([]);
  });
});
