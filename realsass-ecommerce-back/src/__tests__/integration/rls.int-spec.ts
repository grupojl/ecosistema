/**
 * rls.int-spec.ts — ecommerce-back, contra Postgres real (ADR-027, Row Level Security).
 *
 * tenant-isolation.int-spec.ts prueba el aislamiento de la APLICACIÓN (el `where` de cada repository).
 * Este archivo prueba la otra capa: la BASE. Conecta con el rol `eco_app` (sin SUPERUSER ni BYPASSRLS) y comprueba
 * que, aunque una consulta se olvide del `organizationId`, la base no devuelve ni acepta filas de otra organización.
 *
 * Requiere TEST_APP_DATABASE_URL (rol eco_app) además de TEST_DATABASE_URL (administrador, solo para limpiar).
 * Localmente se saltea con aviso; en el CI es obligatorio (ver test/integration-env.js).
 */
import * as pg from 'pg';

const appUrl = process.env['TEST_APP_DATABASE_URL'];
const adminUrl = process.env['TEST_DATABASE_URL'];

// El PrismaService lee DATABASE_URL al construirse: acá tiene que apuntar al rol sin privilegios.
if (appUrl) process.env['DATABASE_URL'] = appUrl;

import { PrismaService } from '@/prisma/prisma.service';
import { runAsSystem, runInTenant } from '@/prisma/tenant-context';
import { PrismaCustomersRepository } from '@/customers/repository/prisma-customers.repository';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';

const maybe = appUrl && adminUrl ? describe : describe.skip;
if (!appUrl || !adminUrl) {
  // eslint-disable-next-line no-console
  console.warn('[rls.int-spec] TEST_APP_DATABASE_URL / TEST_DATABASE_URL no definidas: se saltean los tests de RLS.');
}

maybe('Row Level Security (rol eco_app, Postgres real)', () => {
  const prisma = new PrismaService();
  const admin = new pg.Pool({ connectionString: adminUrl });

  /** Siembra con visibilidad total: es la ruta explícita de sistema. */
  const seed = () =>
    runAsSystem('seed de pruebas', async () => {
      for (const [org, slug] of [[ORG_A, 'a'], [ORG_B, 'b']] as const) {
        const customer = await prisma.storeCustomer.create({ data: { organizationId: org, email: `c-${slug}@x.test` } });
        const product = await prisma.product.create({
          data: {
            organizationId: org,
            name: `Producto ${slug}`,
            handle: `prod-${slug}`,
            variants: { create: [{ organizationId: org, sku: `SKU-${slug}`, title: 'Único', priceCents: 1000 }] },
          },
          include: { variants: true },
        });
        const variant = product.variants[0];
        if (!variant) throw new Error('seed sin variante');
        const cart = await prisma.cart.create({ data: { organizationId: org, customerId: customer.id, sessionId: customer.id } });
        await prisma.cartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity: 1, unitPriceCentsSnapshot: 1000 } });
      }
    });

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await admin.query(
      'TRUNCATE order_status_events, order_items, orders, cart_items, carts, customer_activity_events, customer_addresses, store_customers, inventory_items, product_variants, products, categories RESTART IDENTITY CASCADE',
    );
    await seed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await admin.end();
  });

  it('el rol de la aplicación NO es superusuario ni tiene BYPASSRLS (si lo fuera, nada de esto protegería)', async () => {
    const rows = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  describe('sin alcance de tenant (default-deny)', () => {
    it('una consulta sin organización no ve ninguna fila, en ninguna tabla', async () => {
      expect(await prisma.product.findMany()).toEqual([]);
      expect(await prisma.productVariant.findMany()).toEqual([]);
      expect(await prisma.storeCustomer.findMany()).toEqual([]);
      expect(await prisma.cart.findMany()).toEqual([]);
      expect(await prisma.cartItem.findMany()).toEqual([]);
    });

    it('una escritura sin organización es rechazada por la base', async () => {
      await expect(
        prisma.product.create({ data: { organizationId: ORG_A, name: 'x', handle: 'x' } }),
      ).rejects.toThrow();
    });
  });

  describe('con alcance de una organización', () => {
    it('un findMany SIN where solo devuelve las filas de la propia organización (el where olvidado no filtra)', async () => {
      const products = await runInTenant(ORG_A, () => prisma.product.findMany());

      expect(products).toHaveLength(1);
      expect(products.every((p) => p.organizationId === ORG_A)).toBe(true);
    });

    it('no se puede leer por id una fila de otra organización', async () => {
      const productB = await runAsSystem('buscar id de B', () => prisma.product.findFirstOrThrow({ where: { organizationId: ORG_B } }));

      expect(await runInTenant(ORG_A, () => prisma.product.findUnique({ where: { id: productB.id } }))).toBeNull();
    });

    it('no se puede insertar una fila a nombre de otra organización (WITH CHECK)', async () => {
      await expect(
        runInTenant(ORG_A, () => prisma.product.create({ data: { organizationId: ORG_B, name: 'intruso', handle: 'intruso' } })),
      ).rejects.toThrow();
    });

    it('update y delete sobre filas de otra organización no afectan ninguna fila', async () => {
      const updated = await runInTenant(ORG_A, () => prisma.product.updateMany({ where: { organizationId: ORG_B }, data: { name: 'hackeado' } }));
      const deleted = await runInTenant(ORG_A, () => prisma.product.deleteMany({ where: { organizationId: ORG_B } }));

      expect(updated.count).toBe(0);
      expect(deleted.count).toBe(0);
      const intact = await runInTenant(ORG_B, () => prisma.product.findMany());
      expect(intact.map((p) => p.name)).toEqual(['Producto b']);
    });

    it('no se puede mover una fila propia a otra organización', async () => {
      await expect(
        runInTenant(ORG_A, () => prisma.product.updateMany({ where: { organizationId: ORG_A }, data: { organizationId: ORG_B } })),
      ).rejects.toThrow();
    });

    it('las tablas hijas (sin organization_id) heredan el aislamiento de su padre', async () => {
      const itemsA = await runInTenant(ORG_A, () => prisma.cartItem.findMany({ include: { cart: true } }));
      expect(itemsA).toHaveLength(1);
      expect(itemsA.every((i) => i.cart.organizationId === ORG_A)).toBe(true);

      const cartB = await runAsSystem('buscar carrito de B', () => prisma.cart.findFirstOrThrow({ where: { organizationId: ORG_B } }));
      const variantA = await runInTenant(ORG_A, () => prisma.productVariant.findFirstOrThrow());
      await expect(
        runInTenant(ORG_A, () => prisma.cartItem.create({ data: { cartId: cartB.id, variantId: variantA.id, quantity: 1, unitPriceCentsSnapshot: 1 } })),
      ).rejects.toThrow();
    });

    it('una transacción interactiva respeta el alcance', async () => {
      const seen = await runInTenant(ORG_B, () =>
        prisma.$transaction(async (tx) => (await tx.product.findMany()).map((p) => p.organizationId)),
      );

      expect(seen).toEqual([ORG_B]);
    });
  });

  describe('anonimización de cuenta (GDPR/LGPD)', () => {
    it('anonimiza la cuenta propia, borra sus direcciones y no toca la de otra organización', async () => {
      const customers = new PrismaCustomersRepository(prisma);
      const [a, b] = await runAsSystem('buscar clientes', async () => [
        await prisma.storeCustomer.findFirstOrThrow({ where: { organizationId: ORG_A } }),
        await prisma.storeCustomer.findFirstOrThrow({ where: { organizationId: ORG_B } }),
      ]);
      await runAsSystem('dirección de prueba', () =>
        prisma.customerAddress.create({ data: { customerId: a.id, line1: 'Calle 1', city: 'X', country: 'AR' } }),
      );

      expect(await runInTenant(ORG_B, () => customers.anonymize(ORG_B, a.id))).toBe(false); // id de A desde B
      expect(await runInTenant(ORG_A, () => customers.anonymize(ORG_A, a.id))).toBe(true);

      const after = await runAsSystem('verificar', async () => ({
        a: await prisma.storeCustomer.findUniqueOrThrow({ where: { id: a.id } }),
        b: await prisma.storeCustomer.findUniqueOrThrow({ where: { id: b.id } }),
        addresses: await prisma.customerAddress.count({ where: { customerId: a.id } }),
      }));
      expect(after.a.email).toMatch(/^deleted_.+@deleted.local$/);
      expect(after.addresses).toBe(0);
      expect(after.b.email).toBe('c-b@x.test');
    });
  });

  describe('alcance de sistema', () => {
    it('runAsSystem ve todas las organizaciones', async () => {
      const products = await runAsSystem('prueba', () => prisma.product.findMany());

      expect(new Set(products.map((p) => p.organizationId))).toEqual(new Set([ORG_A, ORG_B]));
    });

    it('runAsSystem exige una razón y runInTenant exige un uuid', () => {
      expect(() => runAsSystem('  ', () => 1)).toThrow(/razón/);
      expect(() => runInTenant('no-es-uuid', () => 1)).toThrow(/inválido/);
    });
  });

  describe('las conexiones del pool no arrastran el tenant anterior', () => {
    it('después de una consulta de A, una consulta sin alcance sigue sin ver nada', async () => {
      await runInTenant(ORG_A, () => prisma.product.findMany());

      expect(await prisma.product.findMany()).toEqual([]);
    });

    it('200 consultas intercaladas de A y B (más que conexiones en el pool) nunca se cruzan', async () => {
      const results = await Promise.all(
        Array.from({ length: 200 }, (_, i) => {
          const org = i % 2 === 0 ? ORG_A : ORG_B;
          return runInTenant(org, async () => ({ org, rows: await prisma.product.findMany() }));
        }),
      );

      for (const { org, rows } of results) {
        expect(rows).toHaveLength(1);
        expect(rows.every((p) => p.organizationId === org)).toBe(true);
      }
    });
  });
});
