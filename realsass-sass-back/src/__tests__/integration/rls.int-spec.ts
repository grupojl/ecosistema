/**
 * rls.int-spec.ts — sass-back, contra Postgres real (ADR-027, Row Level Security, fase 1).
 *
 * tenant-isolation.int-spec.ts prueba el aislamiento de la APLICACIÓN (los services). Este archivo prueba la otra
 * capa: la BASE. Conecta con el rol `eco_app` (sin SUPERUSER ni BYPASSRLS) y comprueba que, aunque una consulta se
 * olvide del `organizationId`, la base no devuelve ni acepta filas de otra organización.
 *
 * Fase 1 cubre: secret_configs, quota_configs, webhook_endpoints, webhook_delivery_logs y markets.
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
import { PrismaMarketRepository } from '@/markets/repository/prisma-market.repository';

const maybe = appUrl && adminUrl ? describe : describe.skip;
if (!appUrl || !adminUrl) {
  // eslint-disable-next-line no-console
  console.warn('[rls.int-spec] TEST_APP_DATABASE_URL / TEST_DATABASE_URL no definidas: se saltean los tests de RLS.');
}

maybe('Row Level Security (rol eco_app, Postgres real)', () => {
  const prisma = new PrismaService();
  const admin = new pg.Pool({ connectionString: adminUrl });

  let orgA = '';
  let orgB = '';

  async function seedOrg(label: string): Promise<string> {
    const user = await prisma.user.create({ data: { firebaseUid: `fb-${label}`, email: `${label}@test.dev`, isOwner: true } });
    const org = await prisma.organization.create({ data: { userId: user.id, name: `Org ${label}`, slug: `org-${label}` } });
    // Las tablas de fase 1 se siembran con visibilidad total: es la ruta explícita de sistema.
    await runAsSystem('seed de pruebas', async () => {
      await prisma.secretConfig.create({
        data: { organizationId: org.id, key: 'API_KEY', valueEncrypted: 'x', valueIv: 'x', valueTag: 'x', keyPrefix: 'sk_' },
      });
      await prisma.quotaConfig.create({ data: { organizationId: org.id, resource: 'products', limit: 10 } });
      await prisma.market.create({ data: { organizationId: org.id, countryCode: 'AR', isDefault: true } });
      const endpoint = await prisma.webhookEndpoint.create({
        data: { organizationId: org.id, url: 'https://hooks.example.com/x', secretEncrypted: 'x', secretPrefix: 'whsec_' },
      });
      await prisma.webhookDeliveryLog.create({ data: { webhookId: endpoint.id, event: 'e', success: true } });
    });
    return org.id;
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await admin.query('TRUNCATE users, organizations RESTART IDENTITY CASCADE');
    orgA = await seedOrg('a');
    orgB = await seedOrg('b');
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
    it('una consulta sin organización no ve ninguna fila de las tablas de fase 1', async () => {
      expect(await prisma.secretConfig.findMany()).toEqual([]);
      expect(await prisma.quotaConfig.findMany()).toEqual([]);
      expect(await prisma.market.findMany()).toEqual([]);
      expect(await prisma.webhookEndpoint.findMany()).toEqual([]);
      expect(await prisma.webhookDeliveryLog.findMany()).toEqual([]);
    });

    it('una escritura sin organización es rechazada por la base', async () => {
      await expect(
        prisma.secretConfig.create({ data: { organizationId: orgA, key: 'K', valueEncrypted: 'x', valueIv: 'x', valueTag: 'x', keyPrefix: 'p' } }),
      ).rejects.toThrow();
    });
  });

  describe('con alcance de una organización', () => {
    it('un findMany SIN where solo devuelve las filas propias (el where olvidado no filtra)', async () => {
      const secrets = await runInTenant(orgA, () => prisma.secretConfig.findMany());

      expect(secrets).toHaveLength(1);
      expect(secrets.every((s) => s.organizationId === orgA)).toBe(true);
    });

    it('no se puede leer por id un secreto de otra organización', async () => {
      const secretB = await runAsSystem('buscar secreto de B', () => prisma.secretConfig.findFirstOrThrow({ where: { organizationId: orgB } }));

      expect(await runInTenant(orgA, () => prisma.secretConfig.findUnique({ where: { id: secretB.id } }))).toBeNull();
    });

    it('no se puede insertar una fila a nombre de otra organización (WITH CHECK)', async () => {
      await expect(
        runInTenant(orgA, () => prisma.webhookEndpoint.create({ data: { organizationId: orgB, url: 'https://x.test', secretEncrypted: 'x', secretPrefix: 'p' } })),
      ).rejects.toThrow();
    });

    it('update y delete sobre filas de otra organización no afectan ninguna fila', async () => {
      const updated = await runInTenant(orgA, () => prisma.quotaConfig.updateMany({ where: { organizationId: orgB }, data: { limit: 999_999 } }));
      const deleted = await runInTenant(orgA, () => prisma.market.deleteMany({ where: { organizationId: orgB } }));

      expect(updated.count).toBe(0);
      expect(deleted.count).toBe(0);
      expect((await runInTenant(orgB, () => prisma.quotaConfig.findFirstOrThrow())).limit).toBe(10);
      expect(await runInTenant(orgB, () => prisma.market.count())).toBe(1);
    });

    it('no se puede mover una fila propia a otra organización', async () => {
      await expect(
        runInTenant(orgA, () => prisma.market.updateMany({ where: { organizationId: orgA }, data: { organizationId: orgB } })),
      ).rejects.toThrow();
    });

    it('el log de entregas de un webhook hereda el aislamiento de su endpoint', async () => {
      const logsA = await runInTenant(orgA, () => prisma.webhookDeliveryLog.findMany({ include: { webhook: true } }));
      expect(logsA).toHaveLength(1);
      expect(logsA.every((l) => l.webhook.organizationId === orgA)).toBe(true);

      const endpointB = await runAsSystem('buscar webhook de B', () => prisma.webhookEndpoint.findFirstOrThrow({ where: { organizationId: orgB } }));
      await expect(
        runInTenant(orgA, () => prisma.webhookDeliveryLog.create({ data: { webhookId: endpointB.id, event: 'e', success: true } })),
      ).rejects.toThrow();
    });

    it('el repository de markets (código real) solo ve los mercados de la organización del alcance', async () => {
      const repo = new PrismaMarketRepository(prisma);

      const markets = await runInTenant(orgA, () => repo.findAll(orgA));
      const olvidado = await runInTenant(orgA, () => repo.findAll(orgB)); // el service pasa el id equivocado

      expect(markets).toHaveLength(1);
      expect(olvidado).toEqual([]);
    });

    it('una transacción interactiva respeta el alcance', async () => {
      const seen = await runInTenant(orgB, () =>
        prisma.$transaction(async (tx) => (await tx.secretConfig.findMany()).map((s) => s.organizationId)),
      );

      expect(seen).toEqual([orgB]);
    });
  });

  describe('alcance de sistema', () => {
    it('runAsSystem ve todas las organizaciones (lo usa el worker de webhooks)', async () => {
      const endpoints = await runAsSystem('prueba', () => prisma.webhookEndpoint.findMany());

      expect(new Set(endpoints.map((e) => e.organizationId))).toEqual(new Set([orgA, orgB]));
    });
  });

  describe('las conexiones del pool no arrastran el tenant anterior', () => {
    it('después de una consulta de A, una consulta sin alcance sigue sin ver nada', async () => {
      await runInTenant(orgA, () => prisma.secretConfig.findMany());

      expect(await prisma.secretConfig.findMany()).toEqual([]);
    });

    it('200 consultas intercaladas de A y B (más que conexiones en el pool) nunca se cruzan', async () => {
      const results = await Promise.all(
        Array.from({ length: 200 }, (_, i) => {
          const org = i % 2 === 0 ? orgA : orgB;
          return runInTenant(org, async () => ({ org, rows: await prisma.quotaConfig.findMany() }));
        }),
      );

      for (const { org, rows } of results) {
        expect(rows).toHaveLength(1);
        expect(rows.every((q) => q.organizationId === org)).toBe(true);
      }
    });
  });
});
