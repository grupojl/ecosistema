/**
 * Prueba de integración CONTRA UNA BASE REAL (ADR-029). Se omite salvo que se pida:
 *
 *   RUN_DB_TESTS=1 pnpm --filter realsass-ecommerce-back test:db
 *
 * Solo hace LECTURAS (SELECT) y un claim del outbox sobre una tabla sin filas pendientes: no escribe nada, así que es
 * seguro correrla contra la base de desarrollo. Valida lo que los tests con mocks no pueden: que la extensión
 * `forTenant` funciona sobre el cliente con el adaptador `pg`, que `set_config` por transacción llega a Postgres y que
 * la consulta del relay (FOR UPDATE SKIP LOCKED) es SQL válido para el servidor.
 */
import 'dotenv/config';
import { PrismaService } from '@/prisma/prisma.service';
import { runAsTenant } from '@/prisma/tenant-context';
import { TenantScopeError } from '@/prisma/tenant-scope';
import { OutboxRelayService } from '@/outbox/outbox-relay.service';

const enabled = process.env['RUN_DB_TESTS'] === '1' && !!process.env['DATABASE_URL'];
const suite = enabled ? describe : describe.skip;

suite('forTenant / RLS / outbox contra Postgres real (solo lectura)', () => {
  let prisma: PrismaService;
  let orgs: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    const rows = await prisma.$queryRaw<Array<{ organization_id: string }>>`
      SELECT DISTINCT organization_id FROM products LIMIT 5`;
    orgs = rows.map((r) => r.organization_id);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('una organización inexistente no ve nada (el filtro llega a la base)', async () => {
    const ghost = prisma.forTenant('org-que-no-existe');
    expect(await ghost.product.count()).toBe(0);
    expect(await ghost.order.findMany()).toEqual([]);
    expect(await ghost.cart.findFirst()).toBeNull();
  });

  it('cada organización ve SOLO sus productos', async () => {
    for (const org of orgs) {
      const products = await prisma.forTenant(org).product.findMany({ select: { organizationId: true } });
      expect(products.every((p) => p.organizationId === org)).toBe(true);
    }
  });

  it('la suma por organización coincide con el total: ninguna fila queda fuera ni se repite', async () => {
    const all = await prisma.product.count();
    const all_orgs = await prisma.$queryRaw<Array<{ organization_id: string }>>`SELECT DISTINCT organization_id FROM products`;
    let sum = 0;
    for (const { organization_id } of all_orgs) sum += await prisma.forTenant(organization_id).product.count();
    expect(sum).toBe(all);
  });

  it('un tenant AJENO no puede leer ni modificar los datos de otro, aunque conozca el id', async () => {
    const owner = orgs[0];
    if (!owner) throw new Error('La base no tiene ningún producto: no se puede probar el aislamiento');
    const product = await prisma.forTenant(owner).product.findFirst({ select: { id: true } });
    if (!product) throw new Error('El tenant dueño no ve su propio producto');
    const stranger = prisma.forTenant('org-ajena');

    expect(await stranger.product.findUnique({ where: { id: product.id } })).toBeNull();
    expect(await stranger.product.findFirst({ where: { id: product.id } })).toBeNull();
    expect(await stranger.product.count({ where: { id: product.id } })).toBe(0);
    // Escrituras NO destructivas: si el alcance fallara, updateMany con data vacía no cambia nada (nunca deleteMany).
    expect(await stranger.product.updateMany({ where: { id: product.id }, data: {} })).toEqual({ count: 0 });
    await expect(stranger.product.update({ where: { id: product.id }, data: {} })).rejects.toThrow();

    // El dueño sí lo ve
    expect(await prisma.forTenant(owner).product.findUnique({ where: { id: product.id } })).not.toBeNull();
  });

  it('apuntar a otra organización explícitamente falla (la query es perezosa: el rechazo llega al esperarla)', async () => {
    const a = prisma.forTenant('org-a');
    await expect(a.product.findMany({ where: { organizationId: 'org-b' } })).rejects.toThrow(TenantScopeError);
    await expect(a.order.create({ data: { organizationId: 'org-b' } as never })).rejects.toThrow('fuera del tenant');
  });

  it('un findUnique con clave compuesta (organizationId_email) sigue funcionando con el alcance', async () => {
    const org = orgs[0] ?? 'org-x';
    const customer = await prisma.forTenant(org).storeCustomer.findUnique({
      where: { organizationId_email: { organizationId: org, email: 'no-existe@example.com' } },
    });
    expect(customer).toBeNull();
  });

  it('runAsTenant fija app.organization_id y vale solo dentro de la transacción', async () => {
    const inside = await runAsTenant(prisma, 'org-test', async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ v: string | null }>>`SELECT current_setting('app.organization_id', true) AS v`;
      return row?.v;
    });
    expect(inside).toBe('org-test');

    const [after] = await prisma.$queryRaw<Array<{ v: string | null }>>`SELECT current_setting('app.organization_id', true) AS v`;
    expect(after?.v ?? '').toBe(''); // no se filtra a la siguiente request del pool
  });

  it('la tabla outbox_events existe y el claim del relay (FOR UPDATE SKIP LOCKED) es SQL válido', async () => {
    expect(await prisma.outboxEvent.count({ where: { processedAt: null, attempts: { gte: 10 } } })).toBeGreaterThanOrEqual(0);
    // El relay marca/actualiza filas: solo se ejecuta si NO hay eventos pendientes, para que esta prueba nunca escriba.
    const pending = await prisma.outboxEvent.count({ where: { processedAt: null } });
    if (pending > 0) return;
    const publish = jest.fn();
    await expect(new OutboxRelayService(prisma, { publish }).processBatch(1)).resolves.toEqual({ published: 0, failed: 0 });
    expect(publish).not.toHaveBeenCalled();
  });
});
