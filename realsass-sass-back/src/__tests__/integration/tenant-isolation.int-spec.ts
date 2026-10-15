/**
 * tenant-isolation.int-spec.ts — sass-back, contra Postgres real.
 *
 * PRIORIDAD MÁXIMA — un fallo acá es una filtración o una escritura entre clientes.
 * Los repositories de config operan por id (el aislamiento vive en los services), así que se prueban los
 * services reales con sus repositories reales; solo cache, auditoría y eventos son dobles.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import type { ConfigCacheService } from '@/config-cache/config-cache.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import { ConfigFlagsService } from '@/config-flags/config-flags.service';
import { PrismaFeatureFlagsRepository } from '@/config-flags/repository/prisma-feature-flags.repository';
import { ConfigThemesService } from '@/config-themes/config-themes.service';
import { PrismaThemesRepository } from '@/config-themes/repository/prisma-themes.repository';
import { PrismaWebhooksRepository } from '@/config-webhooks/repository/prisma-webhooks.repository';

describe('Aislamiento multi-tenant (Postgres real)', () => {
  const prisma = new PrismaService();
  const audit = { log: jest.fn() } as unknown as ConfigAuditService;
  const cache = {} as unknown as ConfigCacheService;
  const events = { emit: jest.fn() } as unknown as EventEmitter2;

  const flagsRepo = new PrismaFeatureFlagsRepository(prisma);
  const flags = new ConfigFlagsService(flagsRepo, cache, audit, events);
  const themesRepo = new PrismaThemesRepository(prisma);
  const themes = new ConfigThemesService(themesRepo, cache, audit, events);
  const webhooksRepo = new PrismaWebhooksRepository(prisma);

  let orgA: string;
  let orgB: string;

  async function seedOrg(label: string): Promise<string> {
    const user = await prisma.user.create({
      data: { firebaseUid: `fb-${label}`, email: `${label}@test.dev`, isOwner: true },
    });
    const org = await prisma.organization.create({ data: { userId: user.id, name: `Org ${label}`, slug: `org-${label}` } });
    return org.id;
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.$executeRawUnsafe(
      'TRUNCATE webhook_delivery_logs, webhook_endpoints, feature_flags, theme_configs, config_audit_logs, organizations, users RESTART IDENTITY CASCADE',
    );
    orgA = await seedOrg('a');
    orgB = await seedOrg('b');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('feature flags', () => {
    it('cada org lista solo sus flags más los globales', async () => {
      await prisma.featureFlag.createMany({
        data: [
          { organizationId: orgA, key: 'solo-a' },
          { organizationId: orgB, key: 'solo-b' },
          { organizationId: null, key: 'global' },
        ],
      });

      expect((await flags.list(orgA)).map((f) => f.key).sort()).toEqual(['global', 'solo-a']);
      expect((await flags.list(orgB)).map((f) => f.key).sort()).toEqual(['global', 'solo-b']);
    });

    it('org B no puede editar un flag de org A ni un flag global, y nada cambia', async () => {
      const own = await prisma.featureFlag.create({ data: { organizationId: orgA, key: 'x', enabled: false } });
      const global = await prisma.featureFlag.create({ data: { organizationId: null, key: 'g', enabled: false } });

      await expect(flags.update(orgB, 'user-b', own.id, { enabled: true })).rejects.toBeInstanceOf(NotFoundException);
      await expect(flags.update(orgB, 'user-b', global.id, { enabled: true })).rejects.toBeInstanceOf(NotFoundException);
      await expect(flags.update(orgA, 'user-a', global.id, { enabled: true })).rejects.toBeInstanceOf(NotFoundException);

      expect((await prisma.featureFlag.findUniqueOrThrow({ where: { id: own.id } })).enabled).toBe(false);
      expect((await prisma.featureFlag.findUniqueOrThrow({ where: { id: global.id } })).enabled).toBe(false);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('la org dueña sí puede editar su flag y queda auditado', async () => {
      const own = await prisma.featureFlag.create({ data: { organizationId: orgA, key: 'x', enabled: false } });

      const updated = await flags.update(orgA, 'user-a', own.id, { enabled: true });

      expect(updated.enabled).toBe(true);
      expect(audit.log).toHaveBeenCalledTimes(1);
    });
  });

  describe('themes', () => {
    it('org B no ve, activa ni borra el tema de org A', async () => {
      const theme = await themes.create(orgA, 'user-a', { name: 'Oscuro' });

      expect(await themes.list(orgB)).toEqual([]);
      await expect(themes.activate(orgB, 'user-b', theme.id)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(themes.remove(orgB, 'user-b', theme.id)).rejects.toBeInstanceOf(ForbiddenException);

      const still = await prisma.themeConfig.findUniqueOrThrow({ where: { id: theme.id } });
      expect(still.isActive).toBe(false);
    });

    it('activar un tema en una org no desactiva el de otra', async () => {
      const a = await themes.create(orgA, 'user-a', { name: 'T' });
      const b = await themes.create(orgB, 'user-b', { name: 'T' });
      await themes.activate(orgB, 'user-b', b.id);

      await themes.activate(orgA, 'user-a', a.id);

      expect((await themesRepo.findActive(orgA))?.id).toBe(a.id);
      expect((await themesRepo.findActive(orgB))?.id).toBe(b.id);
    });
  });

  describe('webhooks', () => {
    async function seedWebhook(organizationId: string) {
      return webhooksRepo.create({
        organizationId,
        url: 'https://example.com/hook',
        events: ['order.created'],
        secretEncrypted: 'cifrado',
        secretHint: 'whsec_…abcd',
      });
    }

    it('org B no encuentra, rota ni borra el webhook de org A', async () => {
      const hook = await seedWebhook(orgA);

      expect(await webhooksRepo.findAllByOrg(orgB)).toEqual([]);
      expect(await webhooksRepo.findActiveByOrg(orgB)).toEqual([]);
      expect(await webhooksRepo.findById(hook.id, orgB)).toBeNull();
      expect(await webhooksRepo.updateSecret(hook.id, orgB, 'otro', 'hint')).toBe(false);
      expect(await webhooksRepo.remove(hook.id, orgB)).toBe(false);

      const intact = await webhooksRepo.findById(hook.id, orgA);
      expect(intact).not.toBeNull();
    });

    it('la org dueña puede borrar su webhook', async () => {
      const hook = await seedWebhook(orgA);

      expect(await webhooksRepo.remove(hook.id, orgA)).toBe(true);
      expect(await webhooksRepo.findById(hook.id, orgA)).toBeNull();
    });
  });
});
