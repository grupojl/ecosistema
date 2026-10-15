/**
 * checkout-idempotency.int-spec.ts — ecommerce-back, contra Postgres real.
 *
 * El checkout reserva stock y crea la orden. Un doble clic, un reintento tras un timeout o un atacante que dispara el
 * mismo carrito en paralelo NO pueden duplicar la orden ni reservar el stock dos veces. Se prueba el OrdersService
 * real con sus repositories reales; el único doble es la resolución del Market (una llamada HTTP a sass-back).
 *
 * Corre con el rol de aplicación si hay TEST_APP_DATABASE_URL (con RLS activo); si no, con el administrador.
 */
const appUrl = process.env['TEST_APP_DATABASE_URL'];
if (appUrl) process.env['DATABASE_URL'] = appUrl;

import * as pg from 'pg';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { runAsSystem, runInTenant } from '@/prisma/tenant-context';
import { OrdersService } from '@/orders/orders.service';
import { InventoryService } from '@/inventory/inventory.service';
import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';
import type { ActivityService } from '@/activity/activity.service';
import type { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import { InsufficientStockError } from '@/inventory/errors/insufficient-stock.error';

const ORG = '00000000-0000-4000-8000-00000000000a';
const adminUrl = process.env['TEST_DATABASE_URL'];

describe('Checkout idempotente y atómico (Postgres real)', () => {
  const prisma = new PrismaService();
  const admin = new pg.Pool({ connectionString: adminUrl });
  const inventory = new InventoryService(prisma, new PrismaInventoryRepository(prisma));
  const orgsClient = {
    resolveMarket: jest.fn().mockResolvedValue({ id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} }),
  } as unknown as OrganizationsClientService;
  const orders = new OrdersService(prisma, new PrismaOrdersRepository(prisma), inventory, { log: jest.fn() } as unknown as ActivityService, orgsClient);

  let variantId = '';
  let customerId = '';
  let cartId = '';

  /** Siembra con visibilidad de sistema (ruta explícita); el checkout en sí corre dentro del alcance de la tienda. */
  async function seed(stock: number, quantity: number) {
    await admin.query(
      'TRUNCATE order_status_events, order_items, orders, cart_items, carts, customer_activity_events, customer_addresses, store_customers, inventory_items, product_variants, products, categories RESTART IDENTITY CASCADE',
    );
    await runAsSystem('seed de pruebas', async () => {
      const product = await prisma.product.create({
        data: {
          organizationId: ORG, name: 'Remera', handle: 'remera', status: 'PUBLISHED',
          variants: { create: [{ organizationId: ORG, sku: 'SKU-1', title: 'M', priceCents: 1000 }] },
        },
        include: { variants: true },
      });
      variantId = product.variants[0]!.id;
      await prisma.inventoryItem.create({ data: { variantId, organizationId: ORG, quantityAvailable: stock } });
      customerId = (await prisma.storeCustomer.create({ data: { organizationId: ORG, email: 'c@x.test' } })).id;
      cartId = (await prisma.cart.create({ data: { organizationId: ORG, customerId, sessionId: customerId } })).id;
      await prisma.cartItem.create({ data: { cartId, variantId, quantity, unitPriceCentsSnapshot: 1000 } });
    });
  }

  const checkout = (over: Partial<{ customerId: string }> = {}) =>
    runInTenant(ORG, () => orders.checkout({ organizationId: ORG, cartId, customerId: over.customerId ?? customerId, shippingAddress: { line1: 'x' } }));
  const state = () =>
    runAsSystem('verificar', async () => ({
      orders: await prisma.order.count(),
      stock: await prisma.inventoryItem.findFirstOrThrow({ where: { variantId } }),
      cart: await prisma.cart.findUniqueOrThrow({ where: { id: cartId } }),
    }));

  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await admin.end();
  });

  it('dos checkouts simultáneos del mismo carrito devuelven LA MISMA orden y reservan el stock una sola vez', async () => {
    await seed(10, 2);

    const [a, b] = await Promise.all([checkout(), checkout()]);

    expect(a.id).toBe(b.id);
    const s = await state();
    expect(s.orders).toBe(1);
    expect(s.stock).toMatchObject({ quantityAvailable: 8, quantityReserved: 2 });
    expect(s.cart.status).toBe('CONVERTED');
  });

  it('20 checkouts simultáneos del mismo carrito => una orden y 2 unidades reservadas (no 40)', async () => {
    await seed(10, 2);

    const results = await Promise.all(Array.from({ length: 20 }, () => checkout()));

    expect(new Set(results.map((o) => o.id)).size).toBe(1);
    const s = await state();
    expect(s.orders).toBe(1);
    expect(s.stock).toMatchObject({ quantityAvailable: 8, quantityReserved: 2 });
  });

  it('un reintento posterior (tras un timeout del cliente) devuelve la orden ya creada', async () => {
    await seed(10, 2);
    const first = await checkout();

    const retry = await checkout();

    expect(retry.id).toBe(first.id);
    expect((await state()).stock).toMatchObject({ quantityAvailable: 8, quantityReserved: 2 });
  });

  it('otro cliente NO puede recuperar la orden de un carrito ajeno', async () => {
    await seed(10, 2);
    await checkout();
    const intruso = await runAsSystem('crear intruso', async () =>
      (await prisma.storeCustomer.create({ data: { organizationId: ORG, email: 'intruso@x.test' } })).id,
    );

    await expect(checkout({ customerId: intruso })).rejects.toBeInstanceOf(BadRequestException);
    expect((await state()).orders).toBe(1);
  });

  it('sin stock suficiente falla, no crea la orden y el carrito sigue ACTIVO (se revierte el reclamo)', async () => {
    await seed(1, 5);

    await expect(checkout()).rejects.toBeInstanceOf(InsufficientStockError);

    const s = await state();
    expect(s.orders).toBe(0);
    expect(s.cart.status).toBe('ACTIVE');
    expect(s.stock).toMatchObject({ quantityAvailable: 1, quantityReserved: 0 });
  });

  it('dos carritos distintos compiten por el último stock: gana uno solo y el otro conserva su carrito', async () => {
    await seed(1, 1);
    const secondCartId = await runAsSystem('segundo carrito', async () => {
      const other = await prisma.storeCustomer.create({ data: { organizationId: ORG, email: 'otro@x.test' } });
      const cart = await prisma.cart.create({ data: { organizationId: ORG, customerId: other.id, sessionId: other.id } });
      await prisma.cartItem.create({ data: { cartId: cart.id, variantId, quantity: 1, unitPriceCentsSnapshot: 1000 } });
      return { cartId: cart.id, customerId: other.id };
    });

    const results = await Promise.allSettled([
      checkout(),
      runInTenant(ORG, () => orders.checkout({ organizationId: ORG, cartId: secondCartId.cartId, customerId: secondCartId.customerId, shippingAddress: {} })),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const s = await state();
    expect(s.orders).toBe(1);
    expect(s.stock).toMatchObject({ quantityAvailable: 0, quantityReserved: 1 });
  });
});
