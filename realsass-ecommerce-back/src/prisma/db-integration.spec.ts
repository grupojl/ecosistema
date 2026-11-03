/**
 * Tests de integración CONTRA POSTGRES REAL con datos de ≥2 organizaciones (DT-TEST-03, ADR-029).
 *
 *   node scripts/test-db-setup.mjs          # crea la base descartable realsass_ecommerce_test (migraciones + RLS + rol)
 *   pnpm --filter realsass-ecommerce-back test:integration
 *
 * ESCRIBE datos, así que se niega a correr salvo que la base se llame *_test. Se omite si no hay TEST_DATABASE_URL.
 * Cubre lo que los mocks no pueden: RLS real (con un rol que NO es superusuario), el FOR UPDATE del checkout bajo
 * concurrencia, el stock sin sobreventa y el relay del outbox con SKIP LOCKED.
 */
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { runAsTenant } from '@/prisma/tenant-context';
import { OrdersService } from '@/orders/orders.service';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';
import { InventoryService } from '@/inventory/inventory.service';
import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { OutboxService } from '@/outbox/outbox.service';
import { OutboxRelayService } from '@/outbox/outbox-relay.service';
import { InsufficientStockError } from '@/inventory/errors/insufficient-stock.error';

const adminUrl = process.env['TEST_DATABASE_URL'];
const appUrl = process.env['TEST_APP_DATABASE_URL'];
const enabled = !!adminUrl && !!appUrl && /_test(\?|$)/.test(adminUrl) && /_test(\?|$)/.test(appUrl);
const suite = enabled ? describe : describe.skip;

/** PrismaService lee DATABASE_URL al construirse: se fija justo antes de crear cada cliente. */
async function client(url: string): Promise<PrismaService> {
  process.env['DATABASE_URL'] = url;
  const p = new PrismaService();
  await p.onModuleInit();
  // Calienta el pool: las conexiones se abren perezosamente y, sin esto, la primera transacción termina antes de que
  // las demás tengan conexión y la carrera que se quiere probar no ocurre.
  await Promise.all(Array.from({ length: 10 }, () => p.$transaction(async (tx) => { await tx.$executeRaw`SELECT pg_sleep(0.3)`; })));
  return p;
}

suite('Postgres real: aislamiento entre organizaciones, checkout, stock y outbox', () => {
  let admin: PrismaService; // superusuario: siembra y verifica (ignora RLS)
  let app: PrismaService; // rol sin superusuario: RLS aplica de verdad
  const orgA = `org-a-${randomUUID()}`;
  const orgB = `org-b-${randomUUID()}`;

  async function seedTenant(org: string, stock: number) {
    const product = await admin.product.create({
      data: { organizationId: org, name: `P ${org}`, handle: `p-${org}`, status: 'PUBLISHED' },
    });
    const variant = await admin.productVariant.create({
      data: { productId: product.id, organizationId: org, sku: `sku-${org}`, title: 'v', priceCents: 1000, currency: 'ARS' },
    });
    await admin.inventoryItem.create({
      data: { variantId: variant.id, organizationId: org, quantityAvailable: stock },
    });
    const customer = await admin.storeCustomer.create({ data: { organizationId: org, email: `c-${org}@x.com` } });
    return { product, variant, customer };
  }

  async function seedCart(org: string, customerId: string, variantId: string, qty: number) {
    return admin.cart.create({
      data: {
        organizationId: org,
        customerId,
        sessionId: randomUUID(),
        items: { create: [{ variantId, quantity: qty, unitPriceCentsSnapshot: 1000 }] },
      },
    });
  }

  const makeOrders = () => {
    const inventory = new InventoryService(admin, new PrismaInventoryRepository(admin));
    const orgsClient = { resolveMarket: async () => ({ id: 'default', fulfillmentConfig: {} }) };
    return new OrdersService(
      admin,
      new PrismaOrdersRepository(admin),
      inventory,
      {} as never,
      orgsClient as never,
      new OutboxService(),
    );
  };
  const checkoutInput = (org: string, cartId: string, customerId: string) => ({
    organizationId: org,
    cartId,
    customerId,
    shippingAddress: { city: 'Rosario' },
  });

  let A: Awaited<ReturnType<typeof seedTenant>>;
  let B: Awaited<ReturnType<typeof seedTenant>>;

  beforeAll(async () => {
    process.env['OUTBOX_ENABLED'] = 'true';
    admin = await client(adminUrl!);
    app = await client(appUrl!);
    A = await seedTenant(orgA, 100);
    B = await seedTenant(orgB, 100);
  });

  afterAll(async () => {
    // Solo borra lo sembrado por esta corrida.
    for (const org of [orgA, orgB]) {
      await admin.outboxEvent.deleteMany({ where: { organizationId: org } });
      await admin.order.deleteMany({ where: { organizationId: org } });
      await admin.cart.deleteMany({ where: { organizationId: org } });
      await admin.storeCustomer.deleteMany({ where: { organizationId: org } });
      await admin.product.deleteMany({ where: { organizationId: org } });
    }
    await admin.onModuleDestroy();
    await app.onModuleDestroy();
  });

  describe('aislamiento', () => {
    it('forTenant: cada organización ve solo lo suyo y no puede leer ni tocar lo ajeno aunque conozca el id', async () => {
      const seenByA = await admin.forTenant(orgA).product.findMany();
      expect(seenByA.map((p) => p.id)).toEqual([A.product.id]);

      const stranger = admin.forTenant(orgB);
      expect(await stranger.product.findUnique({ where: { id: A.product.id } })).toBeNull();
      expect(await stranger.product.updateMany({ where: { id: A.product.id }, data: { name: 'hack' } })).toEqual({ count: 0 });
      expect((await admin.product.findUnique({ where: { id: A.product.id } }))?.name).not.toBe('hack');
    });

    it('RLS: sin contexto de tenant el rol de la app no ve NINGUNA fila', async () => {
      expect(await app.product.count()).toBe(0);
      expect(await app.order.count()).toBe(0);
    });

    it('RLS: con el contexto de A solo se ven filas de A, aunque la consulta pida las de B', async () => {
      const rows = await runAsTenant(app, orgA, (tx) => tx.product.findMany());
      expect(rows.map((r) => r.organizationId)).toEqual([orgA]);
      const asked = await runAsTenant(app, orgA, (tx) => tx.product.findMany({ where: { organizationId: orgB } }));
      expect(asked).toEqual([]);
    });

    it('RLS: dentro del contexto de A, escribir una fila de B es rechazado por la base (WITH CHECK)', async () => {
      await expect(
        runAsTenant(app, orgA, (tx) =>
          tx.product.create({ data: { organizationId: orgB, name: 'inyectado', handle: `inj-${randomUUID()}` } }),
        ),
      ).rejects.toThrow();
      expect(await admin.product.count({ where: { name: 'inyectado' } })).toBe(0);
    });

    it('RLS: modificar o borrar filas de B desde el contexto de A no afecta a nada', async () => {
      const upd = await runAsTenant(app, orgA, (tx) => tx.product.updateMany({ where: { id: B.product.id }, data: { name: 'hack' } }));
      const del = await runAsTenant(app, orgA, (tx) => tx.product.deleteMany({ where: { id: B.product.id } }));
      expect(upd.count + del.count).toBe(0);
      expect(await admin.product.findUnique({ where: { id: B.product.id } })).not.toBeNull();
    });

    it('el contexto del tenant no se filtra a la siguiente conexión del pool', async () => {
      await runAsTenant(app, orgA, (tx) => tx.product.count());
      expect(await app.product.count()).toBe(0);
    });
  });

  describe('checkout', () => {
    it('crea la orden, reserva el stock y escribe el evento en el outbox en la misma transacción', async () => {
      const cart = await seedCart(orgA, A.customer.id, A.variant.id, 3);
      const before = await admin.inventoryItem.findUniqueOrThrow({ where: { variantId: A.variant.id } });

      const order = await makeOrders().checkout(checkoutInput(orgA, cart.id, A.customer.id));

      expect(order.totalCents).toBe(3000);
      const after = await admin.inventoryItem.findUniqueOrThrow({ where: { variantId: A.variant.id } });
      expect(after.quantityAvailable).toBe(before.quantityAvailable - 3);
      expect(after.quantityReserved).toBe(before.quantityReserved + 3);
      expect((await admin.cart.findUniqueOrThrow({ where: { id: cart.id } })).status).toBe('CONVERTED');
      const events = await admin.outboxEvent.findMany({ where: { aggregateId: order.id } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'order.created', organizationId: orgA });
      const history = await admin.orderStatusEvent.findMany({ where: { orderId: order.id } });
      expect(history).toMatchObject([{ fromStatus: null, toStatus: 'PENDING_PAYMENT' }]);
    });

    it('idempotencia: 12 checkouts SIMULTÁNEOS del mismo carrito devuelven la misma orden y reservan UNA vez', async () => {
      const cart = await seedCart(orgA, A.customer.id, A.variant.id, 2);
      const before = await admin.inventoryItem.findUniqueOrThrow({ where: { variantId: A.variant.id } });
      const orders = makeOrders();

      const results = await Promise.all(
        Array.from({ length: 12 }, () => orders.checkout(checkoutInput(orgA, cart.id, A.customer.id))),
      );

      expect(new Set(results.map((o) => o.id)).size).toBe(1);
      expect(await admin.order.count({ where: { cartId: cart.id } })).toBe(1);
      expect(await admin.outboxEvent.count({ where: { aggregateId: results[0]!.id } })).toBe(1);
      const after = await admin.inventoryItem.findUniqueOrThrow({ where: { variantId: A.variant.id } });
      expect(after.quantityReserved - before.quantityReserved).toBe(2);
    });

    it('sin sobreventa: con 1 unidad y dos carritos simultáneos, uno gana y el otro falla; el stock nunca queda negativo', async () => {
      const seed = await seedTenant(`org-c-${randomUUID()}`, 1);
      const org = seed.product.organizationId;
      const c1 = await seedCart(org, seed.customer.id, seed.variant.id, 1);
      const c2 = await seedCart(org, seed.customer.id, seed.variant.id, 1);
      const orders = makeOrders();

      const settled = await Promise.allSettled([
        orders.checkout(checkoutInput(org, c1.id, seed.customer.id)),
        orders.checkout(checkoutInput(org, c2.id, seed.customer.id)),
      ]);

      expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
      const rejected = settled.find((s) => s.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(InsufficientStockError);
      const inv = await admin.inventoryItem.findUniqueOrThrow({ where: { variantId: seed.variant.id } });
      expect(inv).toMatchObject({ quantityAvailable: 0, quantityReserved: 1 });
      // la compra fallida revirtió TODO: ni orden ni evento huérfano
      expect(await admin.order.count({ where: { organizationId: org } })).toBe(1);
      expect(await admin.outboxEvent.count({ where: { organizationId: org } })).toBe(1);
    });

    it('un cliente no puede pagar el carrito de otro, ni una organización el de otra', async () => {
      const cart = await seedCart(orgA, A.customer.id, A.variant.id, 1);
      const other = await admin.storeCustomer.create({ data: { organizationId: orgA, email: `otro-${randomUUID()}@x.com` } });
      await expect(makeOrders().checkout(checkoutInput(orgA, cart.id, other.id))).rejects.toBeInstanceOf(BadRequestException);
      await expect(makeOrders().checkout(checkoutInput(orgB, cart.id, B.customer.id))).rejects.toBeInstanceOf(BadRequestException);
      expect((await admin.cart.findUniqueOrThrow({ where: { id: cart.id } })).status).toBe('ACTIVE');
    });
  });

  describe('outbox relay', () => {
    const makeEvent = (org: string) =>
      admin.outboxEvent.create({
        data: { organizationId: org, aggregateType: 'Order', aggregateId: randomUUID(), type: 'order.created', payload: {} },
      });

    it('publica los eventos pendientes y los marca procesados', async () => {
      await admin.outboxEvent.deleteMany({});
      const e = await makeEvent(orgA);
      const publish = jest.fn().mockResolvedValue(undefined);
      const out = await new OutboxRelayService(admin, { publish }).processBatch();
      expect(out).toEqual({ published: 1, failed: 0 });
      expect(publish).toHaveBeenCalledWith(expect.objectContaining({ id: e.id, organizationId: orgA }));
      expect((await admin.outboxEvent.findUniqueOrThrow({ where: { id: e.id } })).processedAt).not.toBeNull();
    });

    it('un fallo reintenta con espera creciente y registra el error', async () => {
      await admin.outboxEvent.deleteMany({});
      const e = await makeEvent(orgA);
      const publish = jest.fn().mockRejectedValue(new Error('destino caído'));
      const out = await new OutboxRelayService(admin, { publish }).processBatch();
      expect(out).toEqual({ published: 0, failed: 1 });
      const row = await admin.outboxEvent.findUniqueOrThrow({ where: { id: e.id } });
      expect(row).toMatchObject({ attempts: 1, lastError: 'destino caído', processedAt: null });
      expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
      // todavía no toca reintentar: otra vuelta inmediata no lo publica
      expect((await new OutboxRelayService(admin, { publish }).processBatch()).failed).toBe(0);
    });

    it('SKIP LOCKED: dos relays simultáneos no publican el mismo evento dos veces', async () => {
      await admin.outboxEvent.deleteMany({});
      for (let i = 0; i < 10; i++) await makeEvent(orgA);
      const published: string[] = [];
      const publish = jest.fn(async (e: { id: string }) => {
        await new Promise((r) => setTimeout(r, 20));
        published.push(e.id);
      });
      const [r1, r2] = await Promise.all([
        new OutboxRelayService(admin, { publish }).processBatch(5),
        new OutboxRelayService(admin, { publish }).processBatch(5),
      ]);
      expect(r1.published + r2.published).toBe(10);
      expect(new Set(published).size).toBe(10);
    });

    it('con RLS activo el relay (contexto de sistema) ve los eventos de todas las organizaciones', async () => {
      await admin.outboxEvent.deleteMany({});
      await makeEvent(orgA);
      await makeEvent(orgB);
      const publish = jest.fn().mockResolvedValue(undefined);
      const out = await new OutboxRelayService(app, { publish }).processBatch();
      expect(out.published).toBe(2);
    });
  });
});
