/**
 * tenant-isolation.int-spec.ts — ecommerce-back, contra Postgres real.
 *
 * PRIORIDAD MÁXIMA: un fallo acá es una filtración o una escritura entre clientes.
 * Cubre los repositories de catálogo, inventario y órdenes, y la atomicidad del stock (DT-Q-16 / DT-Q-17).
 */
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaCatalogRepository } from '@/catalog/repository/prisma-catalog.repository';
import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';
import { InventoryService } from '@/inventory/inventory.service';
import { InsufficientStockError } from '@/inventory/errors/insufficient-stock.error';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';

describe('Aislamiento multi-tenant (Postgres real)', () => {
  const prisma = new PrismaService();
  const catalog = new PrismaCatalogRepository(prisma);
  const inventory = new PrismaInventoryRepository(prisma);
  const orders = new PrismaOrdersRepository(prisma);
  const inventoryService = new InventoryService(prisma, inventory);

  let productA: { id: string; variantId: string };

  async function seedOrder(organizationId: string, variantId: string) {
    const customer = await prisma.storeCustomer.create({ data: { organizationId, email: `c-${organizationId}@x.test` } });
    const cart = await prisma.cart.create({ data: { organizationId, customerId: customer.id, sessionId: customer.id } });
    return orders.create({
      organizationId,
      cartId: cart.id,
      customerId: customer.id,
      items: [{ variantId, quantity: 1, unitPriceCentsSnapshot: 1000 }],
      subtotalCents: 1000,
      shippingCents: 0,
      totalCents: 1000,
      currency: 'USD',
      shippingAddress: { line1: 'x' },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE order_status_events, order_items, orders, cart_items, carts, customer_activity_events, customer_addresses, store_customers, inventory_items, product_variants, products, categories RESTART IDENTITY CASCADE',
    );
    const p = await catalog.createProduct(ORG_A, {
      name: 'Remera A',
      handle: 'remera',
      variants: [{ sku: 'SKU-1', title: 'M', priceCents: 1000 }],
    });
    const variant = p.variants[0];
    if (!variant) throw new Error('seed sin variante');
    await prisma.inventoryItem.create({ data: { variantId: variant.id, organizationId: ORG_A, quantityAvailable: 5 } });
    productA = { id: p.id, variantId: variant.id };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('catálogo', () => {
    it('org B no ve productos de org A (admin ni storefront)', async () => {
      await catalog.updateProduct(ORG_A, productA.id, { status: 'PUBLISHED' });

      expect(await catalog.listAdmin(ORG_B)).toEqual([]);
      expect(await catalog.listPublished(ORG_B)).toEqual([]);
      expect(await catalog.findByIdAdmin(ORG_B, productA.id)).toBeNull();
      expect(await catalog.findPublishedByHandle(ORG_B, 'remera')).toBeNull();
      expect(await catalog.listPublished(ORG_A)).toHaveLength(1);
    });

    it('org B no puede modificar un producto de org A y el producto queda intacto', async () => {
      await expect(catalog.updateProduct(ORG_B, productA.id, { name: 'hackeado' })).rejects.toThrow();

      const intact = await catalog.findByIdAdmin(ORG_A, productA.id);
      expect(intact?.name).toBe('Remera A');
    });

    it('el mismo handle y SKU pueden existir en dos orgs, pero no dos veces en la misma', async () => {
      await expect(
        catalog.createProduct(ORG_B, { name: 'Remera B', handle: 'remera', variants: [{ sku: 'SKU-1', title: 'M', priceCents: 1 }] }),
      ).resolves.toBeDefined();
      await expect(
        catalog.createProduct(ORG_A, { name: 'Otra', handle: 'remera', variants: [{ sku: 'SKU-9', title: 'M', priceCents: 1 }] }),
      ).rejects.toThrow();
      expect(await catalog.existsByHandle(ORG_B, 'remera')).toBe(true);
    });
  });

  describe('inventario', () => {
    it('org B no lee ni modifica el stock de org A', async () => {
      expect(await inventory.findByVariant(ORG_B, productA.variantId)).toBeNull();
      expect(await inventory.findManyByVariants(ORG_B, [productA.variantId])).toEqual([]);
      await expect(inventory.setAvailable(ORG_B, productA.variantId, 999)).rejects.toThrow();
      await expect(inventory.release(ORG_B, productA.variantId, 1)).rejects.toThrow();
      await expect(inventory.reserve(ORG_B, productA.variantId, 1)).rejects.toBeInstanceOf(InsufficientStockError);

      const stock = await inventory.findByVariant(ORG_A, productA.variantId);
      expect(stock?.quantityAvailable).toBe(5);
    });

    it('InventoryService.setStock de org B sobre una variante de A responde NotFound', async () => {
      await expect(inventoryService.setStock(ORG_B, productA.variantId, 100)).rejects.toThrow(/no encontrado/i);
    });
  });

  describe('stock bajo concurrencia (DT-Q-16 / DT-Q-17)', () => {
    async function reserve(quantity: number): Promise<'ok' | 'sin-stock'> {
      try {
        await prisma.$transaction((tx) => inventoryService.reserveWithinTransaction(tx, productA.variantId, 'SKU-1', quantity));
        return 'ok';
      } catch (err) {
        if (err instanceof InsufficientStockError) return 'sin-stock';
        throw err;
      }
    }

    it('20 checkouts simultáneos por 1 unidad con stock 5: exactamente 5 ganan y el stock termina en 0', async () => {
      const results = await Promise.all(Array.from({ length: 20 }, () => reserve(1)));

      expect(results.filter((r) => r === 'ok')).toHaveLength(5);
      expect(results.filter((r) => r === 'sin-stock')).toHaveLength(15);
      const inv = await inventory.findByVariant(ORG_A, productA.variantId);
      expect(inv).toMatchObject({ quantityAvailable: 0, quantityReserved: 5 });
    });

    it('inventory.reserve (repository): 20 reservas simultáneas por 1 unidad con stock 5 => exactamente 5 ganan', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          inventory.reserve(ORG_A, productA.variantId, 1).then(() => 'ok' as const, (err: unknown) => {
            if (err instanceof InsufficientStockError) return 'sin-stock' as const;
            throw err;
          }),
        ),
      );

      expect(results.filter((r) => r === 'ok')).toHaveLength(5);
      expect(await inventory.findByVariant(ORG_A, productA.variantId)).toMatchObject({ quantityAvailable: 0, quantityReserved: 5 });
    });

    it('inventory.release (repository) es atómico y nunca deja reservado negativo', async () => {
      await inventory.reserve(ORG_A, productA.variantId, 2);

      await Promise.all(Array.from({ length: 6 }, () => inventory.release(ORG_A, productA.variantId, 1)));

      const inv = await inventory.findByVariant(ORG_A, productA.variantId);
      expect(inv?.quantityReserved).toBe(0);
      expect(inv?.quantityAvailable).toBe(3 + 6); // 5 - 2 reservadas + 6 liberadas
    });

    it('release de otra organización falla y no toca el stock', async () => {
      await expect(inventory.release(ORG_B, productA.variantId, 1)).rejects.toThrow();
      expect((await inventory.findByVariant(ORG_A, productA.variantId))?.quantityAvailable).toBe(5);
    });

    it('pedir más que el stock falla y no deja el stock negativo', async () => {
      expect(await reserve(6)).toBe('sin-stock');
      const inv = await inventory.findByVariant(ORG_A, productA.variantId);
      expect(inv).toMatchObject({ quantityAvailable: 5, quantityReserved: 0 });
    });

    it('una transacción que falla después de reservar revierte la reserva', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await inventoryService.reserveWithinTransaction(tx, productA.variantId, 'SKU-1', 3);
          throw new Error('falla el cobro');
        }),
      ).rejects.toThrow('falla el cobro');

      const inv = await inventory.findByVariant(ORG_A, productA.variantId);
      expect(inv).toMatchObject({ quantityAvailable: 5, quantityReserved: 0 });
    });
  });

  describe('órdenes', () => {
    it('org B no ve ni lista las órdenes de org A', async () => {
      const order = await seedOrder(ORG_A, productA.variantId);

      expect(await orders.findById(ORG_B, order.id)).toBeNull();
      expect(await orders.findByCart(ORG_B, order.cartId)).toEqual([]);
      expect(await orders.listByOrg(ORG_B)).toMatchObject({ items: [], total: 0 });
      expect((await orders.listByOrg(ORG_A)).total).toBe(1);
    });
  });
});
