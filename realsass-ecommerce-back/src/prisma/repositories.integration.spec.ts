/**
 * Repositorios Prisma del ecommerce-back contra POSTGRES REAL con ≥2 organizaciones (DT-TEST-13).
 * Misma preparación que db-integration.spec.ts (`pnpm test:db:setup`, `pnpm test:integration`); se omite sin
 * TEST_DATABASE_URL y se niega a correr salvo que la base se llame *_test.
 *
 * Invariante central (norte de testing, Regla 1): una organización nunca lee ni modifica lo de otra, aunque conozca el id.
 */
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaCartRepository } from '@/cart/repository/prisma-cart.repository';
import { PrismaCatalogRepository } from '@/catalog/repository/prisma-catalog.repository';
import { PrismaCustomersRepository } from '@/customers/repository/prisma-customers.repository';
import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';

const url = process.env['TEST_DATABASE_URL'];
const enabled = !!url && /_test(\?|$)/.test(url);
const suite = enabled ? describe : describe.skip;

suite('repositorios Prisma del ecommerce-back contra Postgres real', () => {
  let prisma: PrismaService;
  const run = randomUUID().slice(0, 8);
  const orgA = `repo-a-${run}`;
  const orgB = `repo-b-${run}`;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url;
    prisma = new PrismaService();
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.order.deleteMany({ where: { organizationId: org } });
      await prisma.cart.deleteMany({ where: { organizationId: org } });
      await prisma.storeCustomer.deleteMany({ where: { organizationId: org } });
      await prisma.product.deleteMany({ where: { organizationId: org } });
      await prisma.category.deleteMany({ where: { organizationId: org } });
    }
    await prisma.onModuleDestroy();
  });

  // ── catálogo ───────────────────────────────────────────────────────────────
  describe('catálogo', () => {
    const catalog = () => new PrismaCatalogRepository(prisma);
    const draft = (handle: string, price = 1000) => ({
      name: `Producto ${handle}`, handle, description: 'd',
      variants: [{ sku: `sku-${handle}-${run}`, title: 'Único', priceCents: price, currency: 'ARS' }],
    });

    it('crea el producto con sus variantes e inventario en cero, y aísla organizaciones', async () => {
      const p = await catalog().createProduct(orgA, draft('zapato'));
      expect(p).toMatchObject({ organizationId: orgA, handle: 'zapato', status: 'DRAFT' });
      expect(p.variants).toHaveLength(1);
      expect(p.variants[0]).toMatchObject({ priceCents: 1000, currency: 'ARS' });

      expect(await catalog().existsByHandle(orgA, 'zapato')).toBe(true);
      expect(await catalog().existsByHandle(orgB, 'zapato')).toBe(false); // el handle es único por organización
      expect((await catalog().listAdmin(orgA)).map((x) => x.id)).toEqual([p.id]);
      expect(await catalog().listAdmin(orgB)).toEqual([]);
      expect((await catalog().findByIdAdmin(orgA, p.id))?.id).toBe(p.id);
      expect(await catalog().findByIdAdmin(orgB, p.id)).toBeNull(); // conocer el id no alcanza
    });

    it('cada variante nace con su fila de stock en 0 (sin ella setStock respondía 404)', async () => {
      const p = await catalog().createProduct(orgA, draft('con-stock'));
      expect(p.variants[0]!.inventory).toEqual({ quantityAvailable: 0, quantityReserved: 0 });
      const row = await prisma.inventoryItem.findUnique({ where: { variantId: p.variants[0]!.id } });
      expect(row).toMatchObject({ organizationId: orgA, quantityAvailable: 0 });
      await prisma.product.delete({ where: { id: p.id } });
    });

    it('el mismo handle puede existir en otra organización', async () => {
      const other = await catalog().createProduct(orgB, draft('zapato'));
      expect(other.organizationId).toBe(orgB);
    });

    it('publicar controla qué ve el storefront; actualizar no toca productos ajenos', async () => {
      const repo = catalog();
      const [mine] = await repo.listAdmin(orgA);
      expect(await repo.listPublished(orgA)).toEqual([]); // DRAFT no se publica
      expect(await repo.findPublishedByHandle(orgA, 'zapato')).toBeNull();

      const published = await repo.updateProduct(orgA, mine!.id, { status: 'PUBLISHED', name: 'Zapato nuevo' });
      expect(published).toMatchObject({ status: 'PUBLISHED', name: 'Zapato nuevo' });
      expect((await repo.listPublished(orgA)).map((x) => x.handle)).toEqual(['zapato']);
      expect((await repo.findPublishedByHandle(orgA, 'zapato'))?.id).toBe(mine!.id);
      expect(await repo.findPublishedByHandle(orgB, 'zapato')).toBeNull();

      await expect(repo.updateProduct(orgB, mine!.id, { name: 'hack' })).rejects.toThrow(); // otra organización
      expect((await repo.findByIdAdmin(orgA, mine!.id))?.name).toBe('Zapato nuevo');
    });

    it('filtra por categoría', async () => {
      const cat = await prisma.category.create({ data: { organizationId: orgA, name: 'Calzado', handle: `calzado-${run}` } });
      const withCat = await catalog().createProduct(orgA, { ...draft('bota'), categoryId: cat.id });
      await catalog().updateProduct(orgA, withCat.id, { status: 'PUBLISHED' });
      const filtered = await catalog().listPublished(orgA, `calzado-${run}`);
      expect(filtered.map((x) => x.handle)).toEqual(['bota']);
      expect(filtered[0]!.category?.handle).toBe(`calzado-${run}`);
    });
  });

  // ── inventario ─────────────────────────────────────────────────────────────
  describe('inventario', () => {
    const inventory = () => new PrismaInventoryRepository(prisma);
    let variantA: string;
    let variantB: string;

    beforeAll(async () => {
      const a = await prisma.forTenant(orgA).product.findFirstOrThrow({ where: { handle: 'zapato' }, include: { variants: true } });
      const b = await prisma.forTenant(orgB).product.findFirstOrThrow({ where: { handle: 'zapato' }, include: { variants: true } });
      variantA = a.variants[0]!.id;
      variantB = b.variants[0]!.id;
    });

    it('setAvailable fija el stock, y reservar/liberar mueven unidades sin salirse', async () => {
      const repo = inventory();
      expect((await repo.setAvailable(orgA, variantA, 10)).quantityAvailable).toBe(10);
      const reserved = await repo.reserve(orgA, variantA, 3);
      expect(reserved).toMatchObject({ quantityAvailable: 7, quantityReserved: 3 });
      const released = await repo.release(orgA, variantA, 2);
      expect(released).toMatchObject({ quantityAvailable: 9, quantityReserved: 1 });
      expect((await repo.findByVariant(orgA, variantA))?.quantityAvailable).toBe(9);
    });

    it('lee varias variantes y no cruza organizaciones', async () => {
      const repo = inventory();
      expect(await repo.findByVariant(orgB, variantA)).toBeNull(); // la variante es de A
      const many = await repo.findManyByVariants(orgA, [variantA, variantB]);
      expect(many.map((i) => i.variantId)).toEqual([variantA]); // la de B no se devuelve
    });

    it('otra organización no puede fijar ni reservar stock ajeno', async () => {
      const repo = inventory();
      const before = (await repo.findByVariant(orgA, variantA))!.quantityAvailable;
      await expect(repo.setAvailable(orgB, variantA, 999)).rejects.toThrow();
      await expect(repo.reserve(orgB, variantA, 1)).rejects.toThrow();
      expect((await repo.findByVariant(orgA, variantA))!.quantityAvailable).toBe(before);
    });
  });

  // ── clientes ───────────────────────────────────────────────────────────────
  describe('clientes', () => {
    const customers = () => new PrismaCustomersRepository(prisma);

    it('upsertByEmail crea una vez, es idempotente y mantiene un cliente por (organización, email)', async () => {
      const repo = customers();
      const first = await repo.upsertByEmail(orgA, 'ana@x.com', { displayName: 'Ana' });
      expect(first.created).toBe(true);
      const again = await repo.upsertByEmail(orgA, 'ana@x.com', { phone: '555' });
      expect(again.created).toBe(false);
      expect(again.customer.id).toBe(first.customer.id);
      expect(again.customer).toMatchObject({ displayName: 'Ana', phone: '555' }); // no pisa lo que no viene
      const otherOrg = await repo.upsertByEmail(orgB, 'ana@x.com', {});
      expect(otherOrg.customer.id).not.toBe(first.customer.id); // mismo email, otra organización = otro cliente
    });

    it('anonymize borra los datos personales (email, nombre, teléfono, direcciones y actividad) y conserva las órdenes', async () => {
      const repo = customers();
      const { customer } = await repo.upsertByEmail(orgA, 'borrar@x.com', { displayName: 'Para Borrar', phone: '999' });
      await prisma.customerAddress.create({ data: { customerId: customer.id, line1: 'Calle 1', city: 'Rosario', country: 'AR' } });
      await prisma.customerActivityEvent.create({ data: { organizationId: orgA, customerId: customer.id, sessionId: 's', eventType: 'PRODUCT_VIEW' } });

      expect(await repo.anonymize(orgB, customer.id)).toBe(false); // otra organización no puede borrarlo
      expect((await repo.findById(orgA, customer.id))?.email).toBe('borrar@x.com');

      expect(await repo.anonymize(orgA, customer.id)).toBe(true);
      const after = (await repo.findById(orgA, customer.id))!;
      expect(after.email).toMatch(/^deleted_[0-9a-f-]+@deleted\.invalid$/);
      expect(after).toMatchObject({ displayName: null, phone: null });
      expect(await prisma.customerAddress.count({ where: { customerId: customer.id } })).toBe(0);
      expect(await prisma.customerActivityEvent.count({ where: { customerId: customer.id } })).toBe(0);
      // el mismo email puede volver a registrarse como un cliente nuevo
      const again = await repo.upsertByEmail(orgA, 'borrar@x.com', {});
      expect(again.created).toBe(true);
      expect(again.customer.id).not.toBe(customer.id);
      expect(await repo.anonymize(orgA, 'no-existe')).toBe(false);
    });

    it('findById, update y listByOrg están acotados a la organización', async () => {
      const repo = customers();
      const { customer } = await repo.upsertByEmail(orgA, 'beto@x.com', { displayName: 'Beto' });
      expect((await repo.findById(orgA, customer.id))?.email).toBe('beto@x.com');
      expect(await repo.findById(orgB, customer.id)).toBeNull();

      const updated = await repo.update(orgA, customer.id, { displayName: 'Alberto', phone: '111' });
      expect(updated).toMatchObject({ displayName: 'Alberto', phone: '111' });
      await expect(repo.update(orgB, customer.id, { displayName: 'hack' })).rejects.toThrow();

      const listed = await repo.listByOrg(orgA, { limit: 10 });
      expect(listed.total).toBe(await prisma.storeCustomer.count({ where: { organizationId: orgA } }));
      expect(listed.items.every((c) => c.organizationId === orgA)).toBe(true);
      expect((await repo.listByOrg(orgA, { search: 'alberto' })).items.map((c) => c.email)).toEqual(['beto@x.com']);
      expect((await repo.listByOrg(orgA, { limit: 1, page: 2 })).items).toHaveLength(1);
      expect((await repo.listByOrg(orgB)).total).toBe(1);
    });

  });

  // ── carrito ────────────────────────────────────────────────────────────────
  describe('carrito', () => {
    const cart = () => new PrismaCartRepository(prisma);
    let variantA: string;
    let customerA: string;

    beforeAll(async () => {
      variantA = (await prisma.forTenant(orgA).productVariant.findFirstOrThrow({ where: { sku: { contains: `zapato-${run}` } } })).id;
      customerA = (await new PrismaCustomersRepository(prisma).upsertByEmail(orgA, 'carro@x.com', {})).customer.id;
    });

    it('crea el carrito activo de una sesión y lo recupera solo en su organización', async () => {
      const repo = cart();
      const c = await repo.create(orgA, `cs-${run}`);
      expect(c).toMatchObject({ organizationId: orgA, status: 'ACTIVE', items: [] });
      expect((await repo.findActiveBySession(orgA, `cs-${run}`))?.id).toBe(c.id);
      expect(await repo.findActiveBySession(orgB, `cs-${run}`)).toBeNull();
      expect((await repo.findById(orgA, c.id))?.id).toBe(c.id);
      expect(await repo.findById(orgB, c.id)).toBeNull();
    });

    it('upsertItem suma si la variante ya está, removeItem la quita, y otra organización no puede tocarlo', async () => {
      const repo = cart();
      const c = (await repo.findActiveBySession(orgA, `cs-${run}`))!;
      await repo.upsertItem(orgA, c.id, variantA, 2);
      const summed = await repo.upsertItem(orgA, c.id, variantA, 3);
      expect(summed.items).toHaveLength(1);
      expect(summed.items[0]).toMatchObject({ variantId: variantA, quantity: 5 });
      expect(summed.items[0]!.variant.product.name).toBeDefined();

      await expect(repo.upsertItem(orgB, c.id, variantA, 1)).rejects.toThrow();
      await expect(repo.removeItem(orgB, c.id, variantA)).rejects.toThrow();
      expect((await repo.findById(orgA, c.id))?.items).toHaveLength(1);

      const removed = await repo.removeItem(orgA, c.id, variantA);
      expect(removed.items).toEqual([]);
    });

    it('assignCustomer y complete: el carrito completado deja de ser el activo de la sesión', async () => {
      const repo = cart();
      const c = (await repo.findActiveBySession(orgA, `cs-${run}`))!;
      await repo.assignCustomer(orgA, c.id, customerA);
      expect((await repo.findById(orgA, c.id))?.customerId).toBe(customerA);
      await repo.complete(orgA, c.id);
      expect((await repo.findById(orgA, c.id))?.status).toBe('CONVERTED');
      expect(await repo.findActiveBySession(orgA, `cs-${run}`)).toBeNull();
    });

    it('create con cliente lo asocia desde el inicio', async () => {
      const c = await cart().create(orgA, `cs2-${run}`, customerA);
      expect(c.customerId).toBe(customerA);
    });
  });

  // ── pedidos ────────────────────────────────────────────────────────────────
  describe('pedidos', () => {
    const orders = () => new PrismaOrdersRepository(prisma);
    let variantA: string;
    let customerA: string;
    let orderId: string;

    beforeAll(async () => {
      variantA = (await prisma.forTenant(orgA).productVariant.findFirstOrThrow({ where: { sku: { contains: `zapato-${run}` } } })).id;
      customerA = (await new PrismaCustomersRepository(prisma).upsertByEmail(orgA, 'pedido@x.com', {})).customer.id;
    });

    const newCart = async () => (await new PrismaCartRepository(prisma).create(orgA, `os-${randomUUID()}`, customerA)).id;

    it('crea la orden con su snapshot de precios y la devuelve con sus ítems', async () => {
      const cartId = await newCart();
      const o = await orders().create({
        organizationId: orgA, cartId, customerId: customerA,
        items: [{ variantId: variantA, quantity: 2, unitPriceCentsSnapshot: 1500 }],
        subtotalCents: 3000, shippingCents: 500, totalCents: 3500, currency: 'ARS', shippingAddress: { city: 'Rosario' },
      });
      orderId = o.id;
      expect(o).toMatchObject({ status: 'PENDING_PAYMENT', totalCents: 3500, shippingCents: 500, currency: 'ARS' });
      expect(o.items).toHaveLength(1);
      expect(o.items[0]).toMatchObject({ quantity: 2, unitPriceCentsSnapshot: 1500 });
      expect(o.shippingAddress).toEqual({ city: 'Rosario' });
      // el historial arranca con el estado inicial
      const history = await prisma.orderStatusEvent.findMany({ where: { orderId: o.id } });
      expect(history).toMatchObject([{ fromStatus: null, toStatus: 'PENDING_PAYMENT' }]);
    });

    it('lee por id, por carrito y por cliente (más nuevo primero), siempre acotado a la organización', async () => {
      const repo = orders();
      expect((await repo.findById(orgA, orderId))?.id).toBe(orderId);
      expect(await repo.findById(orgB, orderId)).toBeNull();
      const cartId = (await repo.findById(orgA, orderId))!.cartId;
      expect((await repo.findByCart(orgA, cartId)).map((o) => o.id)).toEqual([orderId]);
      expect(await repo.findByCart(orgB, cartId)).toEqual([]);

      const second = await repo.create({
        organizationId: orgA, cartId: await newCart(), customerId: customerA,
        items: [{ variantId: variantA, quantity: 1, unitPriceCentsSnapshot: 1500 }],
        subtotalCents: 1500, shippingCents: 0, totalCents: 1500, currency: 'ARS',
      });
      const mine = await repo.findByCustomer(orgA, customerA);
      expect(mine.map((o) => o.id)).toEqual([second.id, orderId]);
      expect(await repo.findByCustomer(orgB, customerA)).toEqual([]);
    });

    it('listByOrg filtra por estado y pagina', async () => {
      const repo = orders();
      const all = await repo.listByOrg(orgA, {});
      expect(all.total).toBe(2);
      expect((await repo.listByOrg(orgA, { limit: 1 })).items).toHaveLength(1);
      expect((await repo.listByOrg(orgA, { status: 'PAID' as never })).total).toBe(0);
      expect((await repo.listByOrg(orgB, {})).total).toBe(0);
    });

    it('updateStatus deja el historial; setPaymentIntent solo en la organización dueña', async () => {
      const repo = orders();
      const updated = await repo.updateStatus(orgA, orderId, 'PAID' as never);
      expect(updated.status).toBe('PAID');
      const history = await prisma.orderStatusEvent.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
      expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([[null, 'PENDING_PAYMENT'], ['PENDING_PAYMENT', 'PAID']]);

      await repo.setPaymentIntent(orgA, orderId, 'pi_123');
      expect((await repo.findById(orgA, orderId))?.paymentIntentId).toBe('pi_123');
      await expect(repo.updateStatus(orgB, orderId, 'CANCELLED' as never)).rejects.toThrow();
      expect((await repo.findById(orgA, orderId))?.status).toBe('PAID');
      await repo.setPaymentIntent(orgB, orderId, 'pi_hack').catch(() => undefined);
      expect((await repo.findById(orgA, orderId))?.paymentIntentId).toBe('pi_123');
    });
  });
});
