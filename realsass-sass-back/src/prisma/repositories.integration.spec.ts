/**
 * Repositorios Prisma de sass-back contra POSTGRES REAL con ≥2 organizaciones (DT-TEST-13).
 *
 *   node scripts/test-db-setup.mjs          # crea la base descartable realsass_sass_test
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/realsass_sass_test pnpm --filter realsass-sass-back test:integration
 *
 * ESCRIBE datos: se niega a correr salvo que la base se llame *_test; se omite sin TEST_DATABASE_URL.
 * El invariante central (norte de testing, Regla 1) es el aislamiento: una organización nunca lee, modifica ni revoca
 * lo de otra, aunque conozca el id. Lo demás es contrato de cada repositorio.
 */
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaAffiliateRepository } from '@/affiliate/repository/prisma-affiliate.repository';
import { PrismaAuditRepository } from '@/config-audit/repository/prisma-audit.repository';
import { PrismaCollaboratorsRepository } from '@/collaborators/repository/prisma-collaborators.repository';
import { PrismaFeatureFlagsRepository } from '@/config-flags/repository/prisma-feature-flags.repository';
import { PrismaMarketRepository } from '@/markets/repository/prisma-market.repository';
import { PrismaOrgSettingsRepository } from '@/org-settings/repository/prisma-org-settings.repository';
import { PrismaOrganizationsRepository } from '@/organizations/repository/prisma-organizations.repository';
import { PrismaQuotasRepository } from '@/config-quotas/repository/prisma-quotas.repository';
import { PrismaSecretsRepository } from '@/config-secrets/repository/prisma-secrets.repository';
import { PrismaTemplatesRepository } from '@/config-templates/repository/prisma-templates.repository';
import { PrismaThemesRepository } from '@/config-themes/repository/prisma-themes.repository';
import { PrismaUsersRepository } from '@/users/repository/prisma-users.repository';
import { PrismaWebhooksRepository } from '@/config-webhooks/repository/prisma-webhooks.repository';
import { SessionsService } from '@/sessions/sessions.service';

const url = process.env['TEST_DATABASE_URL'];
const enabled = !!url && /_test(\?|$)/.test(url);
const suite = enabled ? describe : describe.skip;

suite('repositorios Prisma de sass-back contra Postgres real', () => {
  let prisma: PrismaService;
  const run = randomUUID().slice(0, 8);
  const uidA = `uid-a-${run}`;
  const uidB = `uid-b-${run}`;
  let userA: { id: string };
  let userB: { id: string };
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    userA = await prisma.user.create({ data: { firebaseUid: uidA, email: `a-${run}@x.com`, displayName: 'A' } });
    userB = await prisma.user.create({ data: { firebaseUid: uidB, email: `b-${run}@x.com`, displayName: 'B' } });
    orgA = (await prisma.organization.create({ data: { userId: userA.id, name: 'Org A', slug: `org-a-${run}`, countryCode: 'AR' } })).id;
    orgB = (await prisma.organization.create({ data: { userId: userB.id, name: 'Org B', slug: `org-b-${run}`, countryCode: 'BR' } })).id;
  });

  afterAll(async () => {
    // Borra solo lo sembrado por esta corrida (las organizaciones arrastran todo lo suyo por cascada).
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.onModuleDestroy();
  });

  describe('organizaciones', () => {
    it('lista por dueño, cuenta, resuelve usuario y detecta slugs', async () => {
      const repo = new PrismaOrganizationsRepository(prisma);
      expect((await repo.listByFirebaseUid(uidA)).map((o) => o.id)).toEqual([orgA]);
      expect(await repo.countByUserId(userA.id)).toBe(1);
      expect(await repo.resolveUserId(uidA)).toBe(userA.id);
      expect(await repo.resolveUserId('no-existe')).toBeNull();
      expect(await repo.slugExists(`org-a-${run}`)).toBe(true);
      expect(await repo.slugExists(`libre-${run}`)).toBe(false);
      expect((await repo.findByUserId(userA.id))?.id).toBe(orgA);
      expect((await repo.findByFirebaseUid(uidB))?.id).toBe(orgB);
      expect(await repo.findByFirebaseUid('no-existe')).toBeNull();
    });

    it('create + update modifican solo la organización indicada', async () => {
      const repo = new PrismaOrganizationsRepository(prisma);
      const created = await repo.create({ userId: userA.id, firebaseUid: '', slug: `extra-${run}`, name: 'Extra', countryCode: 'MX' });
      expect(created).toMatchObject({ name: 'Extra', slug: `extra-${run}` });
      const updated = await repo.update(created.id, { name: 'Renombrada' } as never);
      expect(updated.name).toBe('Renombrada');
      expect((await prisma.organization.findUnique({ where: { id: orgB } }))?.name).toBe('Org B');
      await prisma.organization.delete({ where: { id: created.id } });
    });

    it('lecturas públicas: por slug y por id exponen solo datos de tienda; las pausadas/suspendidas no aparecen', async () => {
      const repo = new PrismaOrganizationsRepository(prisma);
      const bySlug = await repo.findBySlug(`org-a-${run}`);
      expect(bySlug).toMatchObject({ organizationId: orgA, slug: `org-a-${run}`, countryCode: 'AR' });
      expect(Object.keys(bySlug ?? {})).not.toContain('userId'); // nada interno
      expect((await repo.findPublicById(orgB))?.slug).toBe(`org-b-${run}`);
      expect(await repo.findBySlug('no-existe')).toBeNull();

      await prisma.organization.update({ where: { id: orgB }, data: { storeStatus: 'PAUSED' } });
      const stores = (await repo.listPublicStores(1000)).map((s) => s.slug);
      expect(stores).toContain(`org-a-${run}`);
      expect(stores).not.toContain(`org-b-${run}`);
      await prisma.organization.update({ where: { id: orgB }, data: { storeStatus: 'ACTIVE' } });
    });
  });

  describe('markets', () => {
    it('crea, resuelve por país con fallback al default y aísla organizaciones', async () => {
      const repo = new PrismaMarketRepository(prisma);
      const def = await repo.create({ organizationId: orgA, countryCode: 'AR', isDefault: true, fulfillmentConfig: { priority: 1 } as never });
      const br = await repo.create({ organizationId: orgA, countryCode: 'BR', isDefault: false, fulfillmentConfig: { priority: 2 } as never });
      expect((await repo.findAll(orgA)).map((m) => m.countryCode).sort()).toEqual(['AR', 'BR']);
      expect((await repo.findActive(orgA, 'BR'))?.id).toBe(br.id);
      expect(await repo.findActive(orgA, 'CL')).toBeNull();
      expect((await repo.findDefault(orgA))?.id).toBe(def.id);
      expect(await repo.findAll(orgB)).toEqual([]); // aislamiento
      expect((await repo.findById(br.id))?.countryCode).toBe('BR');
    });

    it('update, setDefault (deja UN solo default) y delete', async () => {
      const repo = new PrismaMarketRepository(prisma);
      const br = (await repo.findActive(orgA, 'BR'))!;
      const off = await repo.update(br.id, orgA, { isActive: false });
      expect(off.isActive).toBe(false);
      expect(await repo.findActive(orgA, 'BR')).toBeNull(); // un mercado inactivo no resuelve
      await repo.update(br.id, orgA, { isActive: true });
      // forTenant: con la organización equivocada no se puede tocar un mercado ajeno (aunque se conozca el id)
      await expect(repo.update(br.id, orgB, { isActive: false })).rejects.toThrow();
      await expect(repo.delete(br.id, orgB)).rejects.toThrow();
      expect((await repo.findById(br.id))?.isActive).toBe(true);

      const nowDefault = await repo.setDefault(br.id, orgA);
      expect(nowDefault.isDefault).toBe(true);
      expect((await repo.findAll(orgA)).filter((m) => m.isDefault)).toHaveLength(1);

      await repo.delete(br.id, orgA);
      expect(await repo.findById(br.id)).toBeNull();
    });
  });

  describe('configuración general (org settings)', () => {
    it('guarda por organización, hace upsert y nunca cruza organizaciones', async () => {
      const repo = new PrismaOrgSettingsRepository(prisma);
      expect(await repo.findByOrg(orgA)).toBeNull();

      await repo.saveGeneral(orgA, { timezone: 'America/Argentina/Cordoba' }, 'uid-a');
      await repo.saveStorefront(orgA, { brand: { publicName: 'Municipio A' } }, 'uid-a');
      const a = await repo.findByOrg(orgA);
      expect(a?.general).toEqual({ timezone: 'America/Argentina/Cordoba' });
      expect(a?.storefront).toEqual({ brand: { publicName: 'Municipio A' } });

      // upsert: guardar de nuevo reemplaza, no duplica la fila (organizationId es único)
      await repo.saveGeneral(orgA, { timezone: 'America/Argentina/Salta' }, 'uid-a');
      expect((await repo.findByOrg(orgA))?.general).toEqual({ timezone: 'America/Argentina/Salta' });
      expect(await prisma.organizationSettings.count({ where: { organizationId: orgA } })).toBe(1);

      // aislamiento: B no ve nada de A, y escribir en B no toca A
      expect(await repo.findByOrg(orgB)).toBeNull();
      await repo.saveStorefront(orgB, { brand: { publicName: 'Municipio B' } }, 'uid-b');
      expect((await repo.findByOrg(orgB))?.storefront).toEqual({ brand: { publicName: 'Municipio B' } });
      expect((await repo.findByOrg(orgA))?.storefront).toEqual({ brand: { publicName: 'Municipio A' } });
    });
  });

  describe('colaboradores', () => {
    it('invita, busca por email, actualiza permisos y remueve; nunca cruza organizaciones', async () => {
      const repo = new PrismaCollaboratorsRepository(prisma);
      const email = `col-${run}@x.com`;
      const created = await repo.create({ organizationId: orgA, email, permissions: { canViewListings: true, canEditListings: true } });
      expect(created).toMatchObject({ email, status: 'PENDING', organizationId: orgA });
      expect(created.permissions.canEditListings).toBe(true);

      expect((await repo.findAllByOrganization(orgA)).map((c) => c.id)).toContain(created.id);
      expect(await repo.findAllByOrganization(orgB)).toEqual([]);
      expect((await repo.findByEmail(email, orgA))?.id).toBe(created.id);
      expect(await repo.findByEmail(email, orgB)).toBeNull(); // mismo email, otra organización
      expect((await repo.findById(created.id, orgA))?.id).toBe(created.id);
      expect(await repo.findById(created.id, orgB)).toBeNull(); // conocer el id no alcanza

      await expect(repo.update(created.id, orgB, { permissions: { canDeleteListings: true } })).rejects.toThrow(); // otra organización
      await expect(repo.remove(created.id, orgB)).rejects.toThrow();
      expect((await repo.findById(created.id, orgA))?.status).toBe('PENDING');
      const updated = await repo.update(created.id, orgA, { permissions: { canDeleteListings: true } });
      expect(updated.permissions.canDeleteListings).toBe(true);
      await repo.remove(created.id, orgA);
      expect((await repo.findById(created.id, orgA))?.status).toBe('REMOVED');
    });
  });

  describe('claves (secrets)', () => {
    const input = (organizationId: string, key: string) => ({
      organizationId, key, valueEncrypted: 'ENC', valueIv: 'IV', valueTag: 'TAG', hint: 'abcd', description: 'd', systemTarget: 'payments',
    });

    it('guarda cifrado, NUNCA devuelve el valor, y solo la organización dueña puede leer, rotar o revocar', async () => {
      const repo = new PrismaSecretsRepository(prisma);
      const s = await repo.create(input(orgA, `K_${run}`));
      expect(Object.keys(s)).not.toEqual(expect.arrayContaining(['valueEncrypted']));
      expect(JSON.stringify(s)).not.toContain('ENC');
      expect((await repo.findActiveByKey(orgA, `K_${run}`))?.id).toBe(s.id);
      expect(await repo.findActiveByKey(orgB, `K_${run}`)).toBeNull();
      expect(await repo.findAllByOrg(orgB)).toEqual([]);
      expect(await repo.findById(s.id, orgB)).toBeNull();

      // otra organización no puede rotar ni revocar aunque conozca el id
      expect(await repo.updateValue(s.id, orgB, { valueEncrypted: 'X', valueIv: 'X', valueTag: 'X', hint: 'zzzz' })).toBeNull();
      expect(await repo.revoke(s.id, orgB)).toBe(false);
      expect((await repo.findById(s.id, orgA))?.isActive).toBe(true);
      expect((await prisma.secretConfig.findUnique({ where: { id: s.id } }))?.valueEncrypted).toBe('ENC');

      const rotated = await repo.updateValue(s.id, orgA, { valueEncrypted: 'ENC2', valueIv: 'IV2', valueTag: 'TAG2', hint: 'wxyz' });
      expect(rotated).toMatchObject({ hint: 'wxyz' });
      expect(rotated?.rotatedAt).toBeInstanceOf(Date);
      expect(await repo.revoke(s.id, orgA)).toBe(true);
      expect(await repo.findActiveByKey(orgA, `K_${run}`)).toBeNull(); // revocada: ya no está activa
    });

    it('con expiresAt y la misma clave tras revocar se puede volver a crear', async () => {
      const repo = new PrismaSecretsRepository(prisma);
      const again = await repo.create({ ...input(orgA, `K_${run}`), expiresAt: new Date(Date.now() + 86_400_000) });
      expect(again.expiresAt).toBeInstanceOf(Date);
      expect(again.isActive).toBe(true);
    });
  });

  describe('webhooks', () => {
    const base = (organizationId: string) => ({
      organizationId, url: 'https://example.com/hook', events: ['config.changed'], description: 'd', secretEncrypted: 'SEALED', secretHint: 'wxyz',
    });

    it('crea sin exponer el secreto, aísla por organización y registra la entrega', async () => {
      const repo = new PrismaWebhooksRepository(prisma);
      const w = await repo.create(base(orgA));
      expect(JSON.stringify(w)).not.toContain('SEALED');
      expect(w).toMatchObject({ isActive: true, failureCount: 0, secretHint: 'wxyz' });
      expect((await repo.findAllByOrg(orgA)).map((x) => x.id)).toContain(w.id);
      expect(await repo.findAllByOrg(orgB)).toEqual([]);
      expect(await repo.findById(w.id, orgB)).toBeNull();

      await prisma.webhookDeliveryLog.createMany({
        data: [1, 2, 3].map((attempt) => ({ webhookId: w.id, event: 'e', success: attempt === 3, attempt, statusCode: 200 })),
      });
      expect(await repo.getLogs(w.id, 2)).toHaveLength(2);
      expect((await repo.getLogs(w.id, 50)).length).toBe(3);
    });

    it('rotar y borrar solo funcionan para la organización dueña', async () => {
      const repo = new PrismaWebhooksRepository(prisma);
      const w = await repo.create(base(orgA));
      expect(await repo.updateSecret(w.id, orgB, 'HACK', 'hack')).toBe(false);
      expect((await prisma.webhookEndpoint.findUnique({ where: { id: w.id } }))?.secretEncrypted).toBe('SEALED');
      expect(await repo.updateSecret(w.id, orgA, 'SEALED2', 'new1')).toBe(true);
      expect((await prisma.webhookEndpoint.findUnique({ where: { id: w.id } }))?.secretEncrypted).toBe('SEALED2');
      expect(await repo.remove(w.id, orgB)).toBe(false);
      expect(await repo.remove(w.id, orgA)).toBe(true);
      expect(await repo.findById(w.id, orgA)).toBeNull();
    });
  });

  describe('temas', () => {
    it('crea, activa (uno solo activo por organización), filtra el público y borra', async () => {
      const repo = new PrismaThemesRepository(prisma);
      const t1 = await repo.create({ organizationId: orgA, name: 'Claro', primaryColor: '#fff' });
      const t2 = await repo.create({ organizationId: orgA, name: 'Oscuro', darkMode: true });
      const other = await repo.create({ organizationId: orgB, name: 'Claro' }); // mismo nombre, otra organización

      await repo.activate(t1.id, orgA);
      await repo.activate(t2.id, orgA);
      const active = await repo.findActive(orgA);
      expect(active?.id).toBe(t2.id);
      expect((await repo.findAllByOrg(orgA)).filter((t) => t.isActive)).toHaveLength(1);
      expect((await repo.findPublicByOrgId(orgA))?.id).toBe(t2.id);
      expect(await repo.findActive(orgB)).toBeNull(); // activar en A no toca B
      expect((await repo.findById(other.id))?.organizationId).toBe(orgB);

      await expect(repo.remove(t1.id, orgB)).rejects.toThrow(); // otra organización: no se toca
      expect(await repo.findById(t1.id)).not.toBeNull();
      await repo.remove(t1.id, orgA);
      expect(await repo.findById(t1.id)).toBeNull();
    });
  });

  describe('feature flags', () => {
    it('lista los de la organización y los globales; actualiza solo el indicado', async () => {
      const repo = new PrismaFeatureFlagsRepository(prisma);
      const mine = await prisma.featureFlag.create({ data: { organizationId: orgA, key: `f_${run}`, enabled: false } });
      const global = await prisma.featureFlag.create({ data: { organizationId: null, key: `g_${run}`, enabled: true } });
      await prisma.featureFlag.create({ data: { organizationId: orgB, key: `b_${run}`, enabled: true } });

      const visibleToA = (await repo.findAllByOrg(orgA)).map((f) => f.key);
      expect(visibleToA).toEqual(expect.arrayContaining([`f_${run}`, `g_${run}`]));
      expect(visibleToA).not.toContain(`b_${run}`); // los de otra organización no se ven
      expect((await repo.findById(mine.id))?.key).toBe(`f_${run}`);

      const updated = await repo.update(mine.id, { enabled: true, rolloutPercentage: 40, description: 'x', conditions: { plan: 'pro' } });
      expect(updated).toMatchObject({ enabled: true, rolloutPercentage: 40, description: 'x' });
      expect((await repo.findById(global.id))?.enabled).toBe(true);
      await prisma.featureFlag.delete({ where: { id: global.id } });
    });
  });

  describe('cuotas', () => {
    it('incrementa de forma atómica, fija el límite y aísla organizaciones', async () => {
      const repo = new PrismaQuotasRepository(prisma);
      const set = await repo.updateLimit(orgA, 'products', 100);
      expect(set).toMatchObject({ limit: 100, currentUsage: 0 });
      await Promise.all([1, 2, 3, 4, 5].map(() => repo.increment(orgA, 'products', 2)));
      expect((await repo.findByResource(orgA, 'products'))?.currentUsage).toBe(10); // 5 × 2, sin pisarse
      expect(await repo.findByResource(orgB, 'products')).toBeNull();
      expect((await repo.findAllByOrg(orgA)).map((q) => q.resource)).toContain('products');
      expect((await repo.updateLimit(orgA, 'products', 5)).limit).toBe(5);
    });
  });

  describe('plantillas', () => {
    it('crea, busca por clave y aísla organizaciones', async () => {
      const repo = new PrismaTemplatesRepository(prisma);
      const t = await repo.create({ organizationId: orgA, key: `welcome_${run}`, content: 'Hola {{name}}' });
      expect((await repo.findByKey(orgA, `welcome_${run}`))?.id).toBe(t.id);
      expect(await repo.findByKey(orgB, `welcome_${run}`)).toBeNull();
      expect((await repo.findAllByOrg(orgA)).map((x) => x.key)).toContain(`welcome_${run}`);
      expect(await repo.findAllByOrg(orgB)).toEqual([]);
    });
  });

  describe('auditoría', () => {
    it('registra y consulta con filtros, orden descendente y paginación, solo de su organización', async () => {
      const repo = new PrismaAuditRepository(prisma);
      for (let i = 0; i < 5; i++) {
        await repo.create({ organizationId: orgA, userId: 'u1', configType: i % 2 ? 'secret' : 'theme', action: `a${i}`, newValue: String(i) });
      }
      await repo.create({ organizationId: orgB, configType: 'theme', action: 'ajena' });

      const all = await repo.findByOrg(orgA, {}, 50, 0);
      expect(all).toHaveLength(5);
      expect(all.every((l) => l.organizationId === orgA)).toBe(true);
      expect(all[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(all[4]!.createdAt.getTime());
      expect((await repo.findByOrg(orgA, { configType: 'secret' }, 50, 0)).every((l) => l.configType === 'secret')).toBe(true);
      expect(await repo.findByOrg(orgA, { userId: 'otro' }, 50, 0)).toEqual([]);
      expect(await repo.findByOrg(orgA, {}, 2, 4)).toHaveLength(1);
      expect(await repo.findByOrg(orgA, { from: new Date(Date.now() + 60_000) }, 50, 0)).toEqual([]);
      expect((await repo.findByOrg(orgA, { to: new Date(Date.now() + 60_000) }, 50, 0)).length).toBe(5);
    });
  });

  describe('sesiones de dispositivo (ADR-020)', () => {
    const sessions = () => new SessionsService(prisma);
    const hints = { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/150.0', ip: '1.2.3.4' };
    const nowSec = () => Math.floor(Date.now() / 1000);

    it('register crea una sesión por dispositivo, renueva la viva y emite una NUEVA si la anterior fue revocada', async () => {
      const svc = sessions();
      const sid = (await svc.register(uidA, hints))!;
      expect(await svc.register(uidA, hints, sid)).toBe(sid); // misma sesión viva: se renueva
      await svc.revoke(uidA, sid);
      const next = (await svc.register(uidA, hints, sid))!;
      expect(next).not.toBe(sid); // una revocada nunca resucita
      expect(await svc.register('uid-inexistente', hints)).toBeNull();
    });

    it('revocar es solo del dueño: otro usuario no puede cerrar la sesión ajena', async () => {
      const svc = sessions();
      const sid = (await svc.register(uidA, hints))!;
      await expect(svc.revoke(uidB, sid)).rejects.toThrow();
      expect(await svc.isRevoked(sid, uidA)).toBe(false);
    });

    it('wasRevokedAfterLogin: el login que se cerró NO puede re-crear la cookie; un login nuevo sí', async () => {
      const svc = sessions();
      const sid = (await svc.register(uidA, hints))!;
      const loginBeforeRevocation = nowSec() - 60;

      expect(await svc.wasRevokedAfterLogin(sid, uidA, loginBeforeRevocation)).toBe(false); // viva: nada que rechazar
      await svc.revoke(uidA, sid);
      expect(await svc.wasRevokedAfterLogin(sid, uidA, loginBeforeRevocation)).toBe(true); // mismo login, cerrado
      expect(await svc.wasRevokedAfterLogin(sid, uidA, nowSec() + 5)).toBe(false); // login nuevo, posterior
    });

    it('wasRevokedAfterLogin no se deja engañar: otro usuario, sid inexistente, sin cookie o sin auth_time', async () => {
      const svc = sessions();
      const sid = (await svc.register(uidA, hints))!;
      await svc.revoke(uidA, sid);
      expect(await svc.wasRevokedAfterLogin(sid, uidB, 1)).toBe(false); // la sesión es de A, no aplica a B
      expect(await svc.wasRevokedAfterLogin(randomUUID(), uidA, 1)).toBe(false);
      expect(await svc.wasRevokedAfterLogin(undefined, uidA, 1)).toBe(false);
      expect(await svc.wasRevokedAfterLogin(sid, uidA, undefined)).toBe(false);
    });

    it('revokeOthers cierra todas menos la actual, y list solo muestra las vivas', async () => {
      const svc = sessions();
      const keep = (await svc.register(uidB, hints))!;
      const other1 = (await svc.register(uidB, { ...hints, ip: '9.9.9.9' }))!;
      const other2 = (await svc.register(uidB, { ...hints, ip: '8.8.8.8' }))!;
      const closed = await svc.revokeOthers(uidB, keep);
      expect(closed).toBeGreaterThanOrEqual(2);
      expect(await svc.isRevoked(other1, uidB)).toBe(true);
      expect(await svc.isRevoked(other2, uidB)).toBe(true);
      expect(await svc.isRevoked(keep, uidB)).toBe(false);
      const listed = await svc.list(uidB, keep);
      expect(listed.filter((x) => x.isCurrent)).toHaveLength(1);
      expect(listed.map((x) => x.id)).not.toContain(other1);
    });
  });

  describe('usuarios y afiliados', () => {
    it('upsert es idempotente por uid y buildProfile arma organizaciones y colaboraciones', async () => {
      const repo = new PrismaUsersRepository(prisma);
      const uid = `uid-new-${run}`;
      const first = await repo.upsert({ firebaseUid: uid, email: `n-${run}@x.com`, displayName: 'Nueva' });
      const second = await repo.upsert({ firebaseUid: uid, email: `n-${run}@x.com`, displayName: 'Renombrada' });
      expect(second.id).toBe(first.id);
      expect(second.displayName).toBe('Renombrada');
      expect((await repo.findByFirebaseUid(uid))?.id).toBe(first.id);
      expect(await repo.findByFirebaseUid('no-existe')).toBeNull();

      const profile = await repo.buildProfile(uidA);
      expect(profile?.organizations.map((o) => o.id)).toEqual([orgA]);
      expect(await repo.buildProfile('no-existe')).toBeNull();
      await prisma.user.delete({ where: { id: first.id } });
    });

    it('getOrganizationAccess: dueño sí, colaborador ACTIVO sí, PENDING y ajeno no', async () => {
      const repo = new PrismaUsersRepository(prisma);
      expect((await repo.getOrganizationAccess(uidA, orgA)).canAccess).toBe(true);
      expect((await repo.getOrganizationAccess(uidA, orgB)).canAccess).toBe(false); // dueño de A no entra a B

      const col = await prisma.collaborator.create({ data: { organizationId: orgB, userId: userA.id, email: `a-${run}@x.com`, status: 'PENDING', permissions: {} } });
      expect((await repo.getOrganizationAccess(uidA, orgB)).canAccess).toBe(false); // pendiente: todavía no
      await prisma.collaborator.update({ where: { id: col.id }, data: { status: 'ACTIVE' } });
      const access = await repo.getOrganizationAccess(uidA, orgB);
      expect(access.canAccess).toBe(true);
      expect(access.role).not.toBe('OWNER');
      await prisma.collaborator.update({ where: { id: col.id }, data: { status: 'REMOVED' } });
      expect((await repo.getOrganizationAccess(uidA, orgB)).canAccess).toBe(false);
    });

    it('afiliados: sin la fila AffiliateData no hay perfil; ensureProfile es idempotente y el contador suma', async () => {
      const repo = new PrismaAffiliateRepository(prisma);
      const code = `ref-${run}`;
      await prisma.user.update({ where: { id: userA.id }, data: { affiliateCode: code, isAffiliate: true } });
      await prisma.user.update({ where: { id: userB.id }, data: { referredByCode: code } });

      expect(await repo.findByCode(code)).toBeNull(); // todavía sin AffiliateData
      expect(await repo.findProfileByFirebaseUid(uidA)).toBeNull();

      const first = await repo.ensureProfile(userA.id, code);
      const again = await repo.ensureProfile(userA.id, code);
      expect(again.id).toBe(first.id);
      expect(first).toMatchObject({ userId: userA.id, referralCode: code, referralCount: 0 });
      expect((await repo.findByCode(code))?.userId).toBe(userA.id);
      expect(await repo.findByCode('no-existe')).toBeNull();
      expect((await repo.findProfileByFirebaseUid(uidA))?.referralCode).toBe(code);

      expect((await repo.findReferralsByCode(code)).map((r) => r.id)).toEqual([userB.id]);

      // setReferredBy: el usuario nuevo aparece entre los referidos del código
      const newcomer = await prisma.user.create({ data: { firebaseUid: `uid-ref-${run}`, email: `ref-${run}@x.com` } });
      expect((await repo.findReferralsByCode(code)).map((r) => r.id)).not.toContain(newcomer.id);
      await repo.setReferredBy(newcomer.id, code);
      expect((await repo.findReferralsByCode(code)).map((r) => r.id)).toContain(newcomer.id);
      await prisma.user.delete({ where: { id: newcomer.id } });

      await Promise.all([repo.incrementReferralCount(userA.id), repo.incrementReferralCount(userA.id)]);
      expect((await repo.findByCode(code))?.referralCount).toBe(2);
    });
  });
});
