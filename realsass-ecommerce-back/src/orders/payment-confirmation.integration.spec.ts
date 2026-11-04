/**
 * Idempotencia de pagos ENTRANTES contra POSTGRES REAL (DT-IDEM-3). Es la parte que toca plata: el mismo evento de
 * pago nunca se aplica dos veces, ni siquiera llegando a la vez; un segundo pago distinto sobre la misma orden y un
 * monto que no coincide se rechazan en vez de aceptarse en silencio.
 * Misma preparación que los demás specs de integración (`pnpm test:db:setup`, `TEST_DATABASE_URL=… pnpm test:integration`).
 */
import { randomUUID } from 'node:crypto';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaCartRepository } from '@/cart/repository/prisma-cart.repository';
import { PrismaCatalogRepository } from '@/catalog/repository/prisma-catalog.repository';
import { PrismaCustomersRepository } from '@/customers/repository/prisma-customers.repository';
import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';
import { InventoryService } from '@/inventory/inventory.service';
import { IdempotencyService, requestHash, STALE_CLAIM_MS } from '@/idempotency/idempotency.service';
import { OrdersService } from '@/orders/orders.service';
import { PaymentConfirmationService } from '@/orders/payment-confirmation.service';
import { OutboxService } from '@/outbox/outbox.service';

const url = process.env['TEST_DATABASE_URL'];
const enabled = !!url && /_test(\?|$)/.test(url);
const suite = enabled ? describe : describe.skip;

suite('idempotencia de pagos contra Postgres real', () => {
  let prisma: PrismaService;
  let orders: OrdersService;
  let payments: PaymentConfirmationService;
  let idempotency: IdempotencyService;
  const run = randomUUID().slice(0, 8);
  const org = `pay-${run}`;
  const otherOrg = `pay-other-${run}`;
  let customerId: string;
  let variantId: string;

  const newOrder = async (quantity = 2) => {
    const carts = new PrismaCartRepository(prisma);
    const cart = await carts.create(org, `s-${randomUUID()}`, customerId);
    await carts.upsertItem(org, cart.id, variantId, quantity);
    return orders.checkout({ organizationId: org, cartId: cart.id, customerId, shippingAddress: { l: 1 } });
  };
  const fresh = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });
  const historyOf = (orderId: string) => prisma.orderStatusEvent.count({ where: { orderId, toStatus: 'PAID' } });
  const paidEvents = (orderId: string) => prisma.outboxEvent.count({ where: { aggregateId: orderId, type: 'order.paid' } });

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url;
    prisma = new PrismaService();
    await prisma.onModuleInit();

    const inventory = new PrismaInventoryRepository(prisma);
    const product = await new PrismaCatalogRepository(prisma).createProduct(org, {
      name: 'Zapato', handle: 'zapato', description: 'd',
      variants: [{ sku: `sku-${run}`, title: 'Único', priceCents: 1000, currency: 'ARS' }],
    });
    variantId = product.variants[0]!.id;
    await inventory.setAvailable(org, variantId, 1000);
    customerId = (await new PrismaCustomersRepository(prisma).upsertByEmail(org, 'pay@x.com', {})).customer.id;

    const market = { id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} };
    orders = new OrdersService(
      prisma,
      new PrismaOrdersRepository(prisma),
      new InventoryService(prisma, inventory),
      { track: jest.fn() } as never,
      { resolveMarket: jest.fn().mockResolvedValue(market) } as never,
      { enabled: false } as never,
    );
    idempotency = new IdempotencyService(prisma);
    const outbox = new OutboxService();
    Object.defineProperty(outbox, 'enabled', { value: true }); // se quiere ver el evento order.paid
    payments = new PaymentConfirmationService(prisma, idempotency, outbox, new InventoryService(prisma, inventory));
  });

  afterAll(async () => {
    for (const o of [org, otherOrg]) {
      await prisma.idempotencyKey.deleteMany({ where: { organizationId: o } });
      await prisma.outboxEvent.deleteMany({ where: { organizationId: o } });
      await prisma.order.deleteMany({ where: { organizationId: o } });
      await prisma.cart.deleteMany({ where: { organizationId: o } });
      await prisma.storeCustomer.deleteMany({ where: { organizationId: o } });
      await prisma.product.deleteMany({ where: { organizationId: o } });
    }
    await prisma.onModuleDestroy();
  });

  describe('confirmar pago', () => {
    it('marca la orden como pagada una vez: estado, pago, historial y evento order.paid', async () => {
      const order = await newOrder();
      const r = await payments.confirm(org, order.id, { eventId: `evt-${randomUUID()}`, paymentIntentId: 'pi_1', amountCents: order.totalCents });

      expect(r).toMatchObject({ orderId: order.id, status: 'PAID', changed: true, replayed: false });
      expect(await fresh(order.id)).toMatchObject({ status: 'PAID', paymentIntentId: 'pi_1' });
      expect(await historyOf(order.id)).toBe(1);
      expect(await paidEvents(order.id)).toBe(1);
    });

    it('el MISMO evento 10 veces a la vez cambia el estado UNA vez (una historia, un order.paid)', async () => {
      const order = await newOrder();
      const eventId = `evt-${randomUUID()}`;
      const settled = await Promise.allSettled(
        Array.from({ length: 10 }, () => payments.confirm(org, order.id, { eventId, paymentIntentId: 'pi_x', amountCents: order.totalCents })),
      );

      const ok = settled.filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof payments.confirm>>> => s.status === 'fulfilled');
      const failed = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
      expect(ok.filter((s) => !s.value.replayed)).toHaveLength(1); // una sola ejecución real; las demás son réplicas de su respuesta
      for (const f of failed) expect(f.reason).toBeInstanceOf(ConflictException); // el resto: "en curso", nunca un error raro
      expect(await historyOf(order.id)).toBe(1);
      expect(await paidEvents(order.id)).toBe(1);
      expect((await fresh(order.id)).status).toBe('PAID');
    });

    it('reentregar el evento después devuelve el mismo resultado guardado (replayed) sin tocar nada', async () => {
      const order = await newOrder();
      const input = { eventId: `evt-${randomUUID()}`, paymentIntentId: 'pi_r', amountCents: order.totalCents };
      await payments.confirm(org, order.id, input);
      const again = await payments.confirm(org, order.id, input);

      expect(again).toMatchObject({ status: 'PAID', changed: true, replayed: true }); // la respuesta original, tal cual
      expect(await historyOf(order.id)).toBe(1);
      expect(await paidEvents(order.id)).toBe(1);
    });

    it('otro evento con el MISMO pago (el proveedor reenvía con id nuevo) es un no-op, no un doble pago', async () => {
      const order = await newOrder();
      await payments.confirm(org, order.id, { eventId: `evt-${randomUUID()}`, paymentIntentId: 'pi_same', amountCents: order.totalCents });
      const dup = await payments.confirm(org, order.id, { eventId: `evt-${randomUUID()}`, paymentIntentId: 'pi_same', amountCents: order.totalCents });

      expect(dup).toMatchObject({ changed: false, replayed: false });
      expect(await historyOf(order.id)).toBe(1);
    });

    it('un pago DISTINTO sobre una orden ya pagada se rechaza (cobro duplicado a reembolsar) y no pisa el original', async () => {
      const order = await newOrder();
      await payments.confirm(org, order.id, { eventId: `evt-${randomUUID()}`, paymentIntentId: 'pi_first', amountCents: order.totalCents });

      await expect(
        payments.confirm(org, order.id, { eventId: `evt-${randomUUID()}`, paymentIntentId: 'pi_second', amountCents: order.totalCents }),
      ).rejects.toThrow(/otro pago/);
      expect((await fresh(order.id)).paymentIntentId).toBe('pi_first');
    });

    it('un monto que no coincide con el total NO marca la orden como pagada', async () => {
      const order = await newOrder();
      await expect(
        payments.confirm(org, order.id, { eventId: `evt-${randomUUID()}`, paymentIntentId: 'pi_low', amountCents: order.totalCents - 1 }),
      ).rejects.toThrow(/no coincide/);
      expect((await fresh(order.id)).status).toBe('PENDING_PAYMENT');
    });

    it('una orden cancelada no admite pago, y el fallo no deja la clave bloqueada para reintentar', async () => {
      const order = await newOrder();
      await orders.updateStatus(org, order.id, 'CANCELLED');
      const input = { eventId: `evt-${randomUUID()}`, paymentIntentId: 'pi_late', amountCents: order.totalCents };

      await expect(payments.confirm(org, order.id, input)).rejects.toThrow(/CANCELLED/);
      await expect(payments.confirm(org, order.id, input)).rejects.toThrow(/CANCELLED/); // el 2.º intento corre de nuevo, no "en curso"
      expect((await fresh(order.id)).status).toBe('CANCELLED');
    });

    it('una orden inexistente o de otra organización da 404 y no deja rastro', async () => {
      const order = await newOrder();
      const eventId = `evt-${randomUUID()}`;
      await expect(payments.confirm(otherOrg, order.id, { eventId, paymentIntentId: 'pi_x' })).rejects.toThrow(/no encontrada/);
      await expect(payments.confirm(org, randomUUID(), { eventId, paymentIntentId: 'pi_x' })).rejects.toThrow(/no encontrada/);
      expect((await fresh(order.id)).status).toBe('PENDING_PAYMENT');
    });
  });

  describe('IdempotencyService', () => {
    const Out = z.object({ n: z.number() });
    const call = (key: string, hash: string, fn: () => Promise<{ n: number }>, scope = 'charge', who = org) =>
      idempotency.run(who, scope, key, hash, Out, fn);

    it('ejecuta una vez bajo concurrencia y todos los reintentos ven el mismo resultado', async () => {
      const key = `k-${randomUUID()}`;
      const fn = jest.fn(async () => {
        await new Promise((r) => setTimeout(r, 60));
        return { n: 42 };
      });
      const settled = await Promise.allSettled(Array.from({ length: 8 }, () => call(key, 'h', fn)));

      expect(fn).toHaveBeenCalledTimes(1);
      for (const s of settled) {
        if (s.status === 'rejected') expect(s.reason).toBeInstanceOf(ConflictException);
        else expect(s.value.result).toEqual({ n: 42 });
      }
      const later = await call(key, 'h', fn);
      expect(later).toEqual({ result: { n: 42 }, replayed: true });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('la misma clave con otro contenido es un error del cliente (422), no un reintento', async () => {
      const key = `k-${randomUUID()}`;
      await call(key, requestHash({ amount: 100 }), async () => ({ n: 1 }));
      await expect(call(key, requestHash({ amount: 999 }), async () => ({ n: 2 }))).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('si la operación falla se libera la clave y el reintento vuelve a ejecutarla', async () => {
      const key = `k-${randomUUID()}`;
      await expect(call(key, 'h', async () => { throw new Error('proveedor caído'); })).rejects.toThrow('proveedor caído');
      const retry = await call(key, 'h', async () => ({ n: 7 }));
      expect(retry).toEqual({ result: { n: 7 }, replayed: false });
    });

    it('una clave es por organización y por ámbito: no se comparte', async () => {
      const key = `k-${randomUUID()}`;
      await call(key, 'h', async () => ({ n: 1 }));
      expect((await call(key, 'h', async () => ({ n: 2 }), 'charge', otherOrg)).replayed).toBe(false);
      expect((await call(key, 'h', async () => ({ n: 3 }), 'refund')).replayed).toBe(false);
    });

    it('un claim abandonado (el proceso murió) se retoma pasado el plazo; antes de eso es "en curso"', async () => {
      const key = `k-${randomUUID()}`;
      await prisma.idempotencyKey.create({ data: { organizationId: org, scope: 'charge', key, requestHash: 'h' } }); // IN_PROGRESS huérfano

      await expect(call(key, 'h', async () => ({ n: 1 }))).rejects.toBeInstanceOf(ConflictException);

      await prisma.idempotencyKey.updateMany({
        where: { organizationId: org, key },
        data: { createdAt: new Date(Date.now() - STALE_CLAIM_MS - 1000) },
      });
      expect(await call(key, 'h', async () => ({ n: 1 }))).toEqual({ result: { n: 1 }, replayed: false });
    });
  });
});
