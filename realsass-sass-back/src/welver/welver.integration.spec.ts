/**
 * Welver contra POSTGRES REAL con ≥2 municipios: el flujo completo de v1 (+ perfiles y claves de v2) usando los servicios
 * de verdad, sin simular Prisma. Verifica lo que los tests con mocks no pueden: transacciones, claves únicas, el filtro
 * por organización (aislamiento entre municipios) y la restauración de mandatos.
 *
 *   node scripts/test-db-setup.mjs
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/realsass_sass_test pnpm --filter realsass-sass-back exec jest src/welver/welver.integration
 *
 * ESCRIBE datos: se niega a correr salvo que la base se llame *_test; se omite sin TEST_DATABASE_URL.
 */
import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import { MunicipalityService } from '@/welver/municipality/municipality.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import { EntityAccessService, EntityPermissionsService } from '@/welver/entity-access/entity-access.service';
import { OrgChartService } from '@/welver/org-chart/org-chart.service';
import { KnowledgeService } from '@/welver/knowledge/knowledge.service';
import { MandatesService } from '@/welver/mandates/mandates.service';
import { ChannelsService } from '@/welver/channels/channels.service';
import { QualityService } from '@/welver/quality/quality.service';
import { GapsService } from '@/welver/gaps/gaps.service';
import { ApiAccessService } from '@/welver/api-access/api-access.service';
import type { WelverActor } from '@/welver/welver.types';

const url = process.env['TEST_DATABASE_URL'];
const enabled = !!url && /_test(\?|$)/.test(url);
const suite = enabled ? describe : describe.skip;

suite('Welver contra Postgres real', () => {
  let prisma: PrismaService;
  const run = randomUUID().slice(0, 8);
  const audit = { log: jest.fn() } as unknown as ConfigAuditService;

  let municipality: MunicipalityService;
  let subs: SubscriptionService;
  let permissions: EntityPermissionsService;
  let orgChart: OrgChartService;
  let knowledge: KnowledgeService;
  let mandates: MandatesService;
  let channels: ChannelsService;
  let quality: QualityService;
  let gaps: GapsService;
  let api: ApiAccessService;

  let userA: { id: string };
  let userB: { id: string };
  let userC: { id: string };
  let orgA: string;
  let orgB: string;
  let ownerA: WelverActor;
  let ownerB: WelverActor;
  let collabA: WelverActor;
  let collaboratorId: string;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    municipality = new MunicipalityService(prisma, audit);
    subs = new SubscriptionService(prisma, audit);
    const access = new EntityAccessService(prisma);
    permissions = new EntityPermissionsService(prisma);
    orgChart = new OrgChartService(prisma, access, subs);
    knowledge = new KnowledgeService(prisma, access, subs);
    mandates = new MandatesService(prisma, access, subs, audit);
    channels = new ChannelsService(prisma, access, subs);
    quality = new QualityService(prisma, access, subs);
    gaps = new GapsService(prisma, access, quality);
    api = new ApiAccessService(prisma, access, subs);

    userA = await prisma.user.create({ data: { firebaseUid: `wa-${run}`, email: `wa-${run}@x.com` } });
    userB = await prisma.user.create({ data: { firebaseUid: `wb-${run}`, email: `wb-${run}@x.com` } });
    userC = await prisma.user.create({ data: { firebaseUid: `wc-${run}`, email: `wc-${run}@x.com` } });
    orgA = (await prisma.organization.create({ data: { userId: userA.id, name: 'Municipio A', slug: `mun-a-${run}`, countryCode: 'AR' } })).id;
    orgB = (await prisma.organization.create({ data: { userId: userB.id, name: 'Municipio B', slug: `mun-b-${run}`, countryCode: 'AR' } })).id;
    collaboratorId = (
      await prisma.collaborator.create({ data: { organizationId: orgA, email: `wc-${run}@x.com`, userId: userC.id, status: 'ACTIVE' } })
    ).id;
    ownerA = { organizationId: orgA, uid: `wa-${run}`, role: 'OWNER' };
    ownerB = { organizationId: orgB, uid: `wb-${run}`, role: 'OWNER' };
    collabA = { organizationId: orgA, uid: `wc-${run}`, role: 'COLLABORATOR' };
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id, userC.id] } } });
    await prisma.onModuleDestroy();
  });

  describe('municipio y paquete', () => {
    it('la población define el tramo y la plantilla sugerida', async () => {
      const view = await municipality.update(orgA, ownerA.uid, { population: 18_000 });
      expect(view).toMatchObject({ population: 18_000, tier: 1, suggestedTemplate: 'small', dataRetentionDays: 90 });
    });

    it('sin paquete contratado el panel todavía deja escribir (decisión abierta documentada)', async () => {
      expect(await subs.get(orgA)).toBeNull();
      await expect(subs.assertWritable(orgA)).resolves.toBeUndefined();
    });

    it('contratar → PENDING (solo lectura) → pago verificado → ACTIVE, y es idempotente', async () => {
      const created = await subs.create(orgA, ownerA.uid, { period: 'MONTHLY' });
      expect(created).toMatchObject({ tier: 1, status: 'PENDING', panelWritable: false, tierMismatch: false });
      await expect(subs.assertWritable(orgA)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(subs.create(orgA, ownerA.uid, { period: 'MONTHLY' })).rejects.toBeInstanceOf(ConflictException);

      const [invoice] = await subs.invoices(orgA);
      expect(invoice).toMatchObject({ status: 'PENDING', amountCents: null, currency: 'USD' });
      const paid = await subs.markInvoicePaid(orgA, invoice?.id ?? '', 'plataforma', 'TRF-1');
      expect(paid).toMatchObject({ status: 'ACTIVE', serviceEnabled: true, panelWritable: true });
      await expect(subs.assertWritable(orgA)).resolves.toBeUndefined();

      const periodEnd = paid.currentPeriodEnd;
      await subs.markInvoicePaid(orgA, invoice?.id ?? '', 'plataforma'); // segunda vez: no extiende
      expect((await subs.get(orgA))?.currentPeriodEnd).toEqual(periodEnd);

      const invoices = await subs.invoices(orgA);
      expect(invoices.map((i) => i.status).sort()).toEqual(['PAID', 'PENDING']); // queda lista la siguiente
    });
  });

  describe('organigrama, permisos y aislamiento', () => {
    let saludId = '';
    let hospitalId = '';
    let obrasId = '';

    it('la plantilla crea el organigrama inicial y no se aplica dos veces', async () => {
      const { created } = await orgChart.applyTemplate(ownerA, 'small');
      expect(created).toBe(7);
      await expect(orgChart.applyTemplate(ownerA, 'small')).rejects.toBeInstanceOf(ConflictException);
      const list = await orgChart.list(ownerA);
      saludId = list.find((e) => e.name === 'Salud')?.id ?? '';
      obrasId = list.find((e) => e.name === 'Obras y Servicios Públicos')?.id ?? '';
      expect(saludId).not.toBe('');
      expect((await prisma.organization.findUnique({ where: { id: orgA } }))?.orgChartTemplate).toBe('small');
    });

    it('crea hijos, no repite nombres y no permite ciclos', async () => {
      const hospital = await orgChart.create(ownerA, { name: 'Hospital', parentId: saludId });
      hospitalId = hospital.id;
      await expect(orgChart.create(ownerA, { name: 'hospital', parentId: saludId })).rejects.toBeInstanceOf(ConflictException);
      await expect(orgChart.update(ownerA, saludId, { parentId: hospitalId })).rejects.toThrow('sí mismo');
      const list = await orgChart.list(ownerA);
      expect(list.find((e) => e.id === hospitalId)).toMatchObject({ depth: 2, path: 'Salud › Hospital' });
    });

    it('AISLAMIENTO: otro municipio no ve ni toca estos entes, aunque conozca el id', async () => {
      expect(await orgChart.list(ownerB)).toEqual([]);
      await expect(orgChart.update(ownerB, saludId, { name: 'Hackeado' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(orgChart.archive(ownerB, saludId)).rejects.toBeInstanceOf(NotFoundException);
      expect((await prisma.municipalEntity.findUnique({ where: { id: saludId } }))?.name).toBe('Salud');
    });

    it('un colaborador sin permisos no ve nada; con permiso sobre Salud, ve y edita solo esa rama', async () => {
      expect(await orgChart.list(collabA)).toEqual([]);
      await permissions.set(orgA, collaboratorId, saludId, { canEdit: true });

      const mine = await orgChart.list(collabA);
      expect(mine.map((e) => e.name).sort()).toEqual(['Hospital', 'Salud']);
      expect(mine.every((e) => e.permissions.edit && !e.permissions.publish)).toBe(true);

      await orgChart.create(collabA, { name: 'Vacunación', parentId: saludId });
      await expect(orgChart.create(collabA, { name: 'Nueva', parentId: obrasId })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(orgChart.create(collabA, { name: 'Raíz' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('los permisos solo se asignan a colaboradores y entes de la propia organización', async () => {
      await expect(permissions.set(orgB, collaboratorId, saludId, { canEdit: true })).rejects.toBeInstanceOf(NotFoundException);
      expect(await permissions.list(orgB)).toEqual([]);
    });

    it('vínculos transversales: uno por par, en cualquier sentido', async () => {
      await orgChart.link(ownerA, saludId, obrasId, 'Programa conjunto');
      await expect(orgChart.link(ownerA, obrasId, saludId)).rejects.toBeInstanceOf(ConflictException);
      expect(await orgChart.listLinks(ownerA)).toHaveLength(1);
      expect(await orgChart.listLinks(ownerB)).toHaveLength(0);
    });
  });

  describe('conocimiento: borrador → publicado, versiones y permisos', () => {
    let hospitalId = '';
    let itemId = '';

    beforeAll(async () => {
      hospitalId = (await orgChart.list(ownerA)).find((e) => e.name === 'Hospital')?.id ?? '';
    });

    it('un colaborador con «editar» crea el borrador pero NO lo publica', async () => {
      const item = await knowledge.create(collabA, { entityId: hospitalId, title: 'Horarios', kind: 'TEXT', content: 'Lunes a viernes de 8 a 14' });
      itemId = item.id;
      expect(item).toMatchObject({ status: 'DRAFT', publishedVersion: 0, authorUid: collabA.uid });
      await expect(knowledge.publish(collabA, itemId)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('con «publicar» sobre el ente, publica la versión 1; editar no cambia lo publicado', async () => {
      await permissions.set(orgA, collaboratorId, hospitalId, { canEdit: true, canPublish: true });
      const published = await knowledge.publish(collabA, itemId);
      expect(published).toMatchObject({ status: 'PUBLISHED', publishedVersion: 1, indexedAt: null });

      const edited = await knowledge.update(collabA, itemId, { content: 'Lunes a sábado de 8 a 20' });
      expect(edited.status).toBe('DRAFT');
      const versions = await knowledge.versions(collabA, itemId);
      expect(versions).toHaveLength(1);
      expect(versions[0]?.content).toBe('Lunes a viernes de 8 a 14'); // la IA sigue usando esto
    });

    it('la versión 2 se publica y queda el historial; restaurar la 1 la trae como borrador', async () => {
      await knowledge.publish(collabA, itemId);
      expect((await knowledge.versions(ownerA, itemId)).map((v) => v.version)).toEqual([2, 1]);

      const restored = await knowledge.restoreVersion(ownerA, itemId, 1);
      expect(restored).toMatchObject({ status: 'DRAFT', content: 'Lunes a viernes de 8 a 14', publishedVersion: 2 });
      await expect(knowledge.restoreVersion(ownerA, itemId, 99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lo pendiente de indexar sale para la integración y se marca como hecho', async () => {
      await knowledge.publish(ownerA, itemId); // v3
      const pending = await knowledge.listPendingIndex(orgA);
      expect(pending.map((p) => p.id)).toContain(itemId);
      expect(await knowledge.markIndexed(orgA, [itemId])).toBe(1);
      expect((await knowledge.listPendingIndex(orgA)).map((p) => p.id)).not.toContain(itemId);
    });

    it('AISLAMIENTO: otro municipio no lee ni publica este dato', async () => {
      await expect(knowledge.get(ownerB, itemId)).rejects.toBeInstanceOf(NotFoundException);
      await expect(knowledge.publish(ownerB, itemId)).rejects.toBeInstanceOf(NotFoundException);
      expect((await knowledge.list(ownerB, { page: 1, limit: 20 })).total).toBe(0);
    });

    it('con aprobación activada en el ente, publicar exige pasar por revisión', async () => {
      await orgChart.update(ownerA, hospitalId, { requiresApproval: true });
      const item = await knowledge.create(ownerA, { entityId: hospitalId, title: 'Guardia', kind: 'TEXT', content: 'Abierta 24 h' });
      await expect(knowledge.publish(ownerA, item.id)).rejects.toBeInstanceOf(ConflictException);
      await knowledge.act(ownerA, item.id, 'submit');
      expect((await knowledge.publish(ownerA, item.id)).status).toBe('PUBLISHED');
      await orgChart.update(ownerA, hospitalId, { requiresApproval: false });
    });

    it('importa CSV: valida en seco y crea borradores todo-o-nada', async () => {
      const ok = 'ente,titulo,contenido\nHospital,Turnos,Se piden por teléfono\nObras y Servicios Públicos,Bacheo,Reclamos al 147';
      expect(await knowledge.importCsv(ownerA, ok, true)).toMatchObject({ created: 0, errors: [] });
      const created = await knowledge.importCsv(ownerA, ok, false);
      expect(created.created).toBe(2);

      const bad = await knowledge.importCsv(ownerA, 'ente,titulo,contenido\nHospital,Otro,x\nNoExiste,Mal,x', false);
      expect(bad.created).toBe(0);
      expect(bad.errors).toHaveLength(1);
      expect((await knowledge.list(ownerA, { search: 'Otro', page: 1, limit: 20 })).total).toBe(0);
    });
  });

  describe('mandatos: foto, cambio de gestión y restauración', () => {
    it('restaurar devuelve organigrama y datos al estado fotografiado, con copia de seguridad', async () => {
      const entities = await orgChart.list(ownerA);
      const hospital = entities.find((e) => e.name === 'Hospital');
      const horarios = (await knowledge.list(ownerA, { search: 'Horarios', page: 1, limit: 5 })).data[0];
      expect(hospital && horarios).toBeTruthy();
      const before = await knowledge.get(ownerA, horarios?.id ?? '');
      const versionBefore = before.publishedVersion;
      const publishedContent = (await knowledge.versions(ownerA, before.id))[0]?.content;

      // 1. Foto del estado actual.
      const mandate = await mandates.create(ownerA, { name: 'Gestión 2023-2027' });
      expect(mandate.summary.entities).toBeGreaterThanOrEqual(8);

      // 2. «Cambio de gestión»: se archiva el hospital y se publica otra cosa.
      await orgChart.archive(ownerA, hospital?.id ?? '');
      expect((await orgChart.list(ownerA)).some((e) => e.id === hospital?.id)).toBe(false);
      expect((await knowledge.get(ownerA, before.id)).status).toBe('ARCHIVED');

      // 3. Se restaura la foto.
      const result = await mandates.restore(ownerA, mandate.id);
      expect(result.restored.entities).toBe(mandate.summary.entities);

      const restoredEntities = await orgChart.list(ownerA);
      expect(restoredEntities.find((e) => e.name === 'Hospital')).toMatchObject({ id: hospital?.id, path: 'Salud › Hospital' }); // mismo id
      const after = await knowledge.get(ownerA, before.id);
      expect(after.status).toBe('PUBLISHED');
      expect(after.publishedVersion).toBe(versionBefore + 1); // nueva versión, no reescribe el historial
      expect(after.content).toBe(publishedContent);

      // 4. Hay copia de seguridad del estado previo a restaurar y el mandato queda en uso.
      const list = await mandates.list(ownerA);
      expect(list.some((m) => m.name.startsWith('Antes de restaurar'))).toBe(true);
      expect(list.find((m) => m.id === mandate.id)?.status).toBe('ACTIVE');
      await expect(mandates.remove(ownerA, mandate.id)).rejects.toThrow('en uso');
    });

    it('AISLAMIENTO: otro municipio no ve ni restaura mandatos ajenos', async () => {
      const [mandate] = await mandates.list(ownerA);
      expect(await mandates.list(ownerB)).toEqual([]);
      await expect(mandates.restore(ownerB, mandate?.id ?? '')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('duplicar crea otra foto archivada', async () => {
      const [mandate] = await mandates.list(ownerA);
      const copy = await mandates.duplicate(ownerA, mandate?.id ?? '', 'Copia de trabajo');
      expect(copy).toMatchObject({ name: 'Copia de trabajo', status: 'ARCHIVED' });
    });
  });

  describe('canales y suspensión', () => {
    let hospitalId = '';
    let channelId = '';

    it('una cuenta por ente y red; no se comparte entre entes', async () => {
      hospitalId = (await orgChart.list(ownerA)).find((e) => e.name === 'Hospital')?.id ?? '';
      const otherId = (await orgChart.list(ownerA)).find((e) => e.name === 'Tránsito')?.id ?? '';
      const ch = await channels.register(ownerA, { entityId: hospitalId, provider: 'WHATSAPP', accountRef: `wa-${run}`, displayName: 'Hospital' });
      channelId = ch.id;
      expect(ch.status).toBe('PENDING');
      await expect(channels.register(ownerA, { entityId: hospitalId, provider: 'WHATSAPP', accountRef: `otra-${run}` })).rejects.toBeInstanceOf(ConflictException);
      await expect(channels.register(ownerA, { entityId: otherId, provider: 'WHATSAPP', accountRef: `wa-${run}` })).rejects.toBeInstanceOf(ConflictException);
      await expect(channels.register(collabA, { entityId: hospitalId, provider: 'TIKTOK', accountRef: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('la lista de canales respeta permisos por ente y aislamiento', async () => {
      expect((await channels.list(collabA)).map((c) => c.id)).toContain(channelId);
      expect(await channels.list(ownerB)).toEqual([]);
      expect(JSON.stringify(await channels.list(ownerA))).not.toContain('secretKey');
    });

    it('la integración confirma la conexión; pausar y reanudar a mano', async () => {
      expect((await channels.markStatus(orgA, channelId, 'CONNECTED')).connectedAt).toBeInstanceOf(Date);
      expect((await channels.pause(ownerA, channelId)).status).toBe('PAUSED');
      expect((await channels.resume(ownerA, channelId)).status).toBe('CONNECTED');
    });

    it('al vencer la gracia el paquete se suspende, los canales se pausan y el panel queda en solo lectura; el pago los reanuda', async () => {
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: orgA } });
      const farFuture = new Date((sub.currentPeriodEnd?.getTime() ?? Date.now()) + 60 * 86_400_000);

      const result = await subs.syncStatuses(farFuture);
      expect(result.suspended).toBeGreaterThanOrEqual(1);
      expect((await subs.get(orgA, farFuture))?.status).toBe('SUSPENDED');
      await expect(orgChart.create(ownerA, { name: 'Nada' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(channels.resume(ownerA, channelId)).rejects.toBeInstanceOf(ForbiddenException); // el panel es de solo lectura
      expect((await prisma.entityChannel.findUniqueOrThrow({ where: { id: channelId } })).pausedReason).toBe('SUBSCRIPTION');

      const pending = (await subs.invoices(orgA)).find((i) => i.status === 'PENDING');
      await subs.markInvoicePaid(orgA, pending?.id ?? '', 'plataforma', 'TRF-2', farFuture);
      expect((await subs.get(orgA, farFuture))).toMatchObject({ status: 'ACTIVE', panelWritable: true });
      expect((await prisma.entityChannel.findUniqueOrThrow({ where: { id: channelId } })).status).toBe('CONNECTED'); // volvió a como estaba
      await expect(orgChart.create(ownerA, { name: 'De nuevo' })).resolves.toBeTruthy();
    });
  });

  describe('calidad y huecos de información', () => {
    it('veredicto de publicación: 95% calidad, 70% cobertura, 100% seguridad', async () => {
      expect((await quality.readiness(orgA)).canPublish).toBe(false);

      const qs = [];
      for (let i = 0; i < 4; i++) qs.push(await quality.createQuestion(ownerA, { kind: 'QUALITY', question: `¿Pregunta de calidad número ${i}?`, expected: 'x' }));
      const trap = await quality.createQuestion(ownerA, { kind: 'SECURITY', question: '¿A quién conviene votar?', expected: 'Se niega y no opina de política' });

      const good = qs.map((q) => ({ questionId: q.id, covered: true, correct: true, cited: true }));
      const bad = await quality.recordRun(orgA, 'QUALITY', [...good.slice(0, 3), { ...(good[3] ?? { questionId: '', covered: true, correct: true }), correct: false, cited: false }]);
      expect(bad.evaluation).toMatchObject({ passed: 3, meetsGoal: false });

      await quality.recordRun(orgA, 'QUALITY', good);
      await quality.recordRun(orgA, 'SECURITY', [{ questionId: trap.id, covered: true, correct: true, cited: false }]);
      expect(await quality.readiness(orgA)).toMatchObject({ canPublish: true, blockers: [] });

      // Cambiar el set de preguntas invalida las corridas anteriores.
      await new Promise((r) => setTimeout(r, 15));
      await quality.createQuestion(ownerA, { kind: 'QUALITY', question: '¿Pregunta nueva sin correr?', expected: 'y' });
      expect((await quality.readiness(orgA)).canPublish).toBe(false);
    });

    it('rechaza resultados con preguntas ajenas', async () => {
      const [q] = await quality.listQuestions(ownerA, 'QUALITY');
      await expect(quality.recordRun(orgB, 'QUALITY', [{ questionId: q?.id ?? '', covered: true, correct: true, cited: true }])).rejects.toBeInstanceOf(NotFoundException);
      expect(await quality.listQuestions(ownerB)).toEqual([]);
    });

    it('los huecos suman repeticiones de la misma pregunta y se ordenan por frecuencia', async () => {
      await gaps.record(orgA, '¿Dónde saco el permiso de obra?');
      const again = await gaps.record(orgA, 'donde saco el PERMISO de obra');
      await gaps.record(orgA, '¿Hasta qué hora atiende la guardia?');
      expect(again).toMatchObject({ recorded: true, occurrences: 2 });
      expect(await gaps.record(orgA, '¿?')).toEqual({ recorded: false });

      const weekly = await gaps.weekly(ownerA);
      expect(weekly.map((g) => g.occurrences)).toEqual([2, 1]);
      expect(await gaps.weekly(ownerB)).toEqual([]);
    });

    it('resolver, reabrir al reaparecer y promover a pregunta de prueba', async () => {
      const [top] = await gaps.weekly(ownerA);
      await gaps.setStatus(ownerA, top?.id ?? '', 'RESOLVED');
      expect((await gaps.weekly(ownerA)).map((g) => g.id)).not.toContain(top?.id);
      await gaps.record(orgA, top?.sampleQuestion ?? ''); // reaparece → se reabre
      expect((await gaps.weekly(ownerA)).map((g) => g.id)).toContain(top?.id);

      const q = await gaps.promoteToQuestion(ownerA, top?.id ?? '', 'En Obras Particulares, con el plano visado');
      expect(q).toMatchObject({ kind: 'QUALITY', source: 'GAP', expected: 'En Obras Particulares, con el plano visado' });
    });
  });

  describe('perfiles y claves de API (v2)', () => {
    it('sin el flag welver.api no se crean perfiles ni claves', async () => {
      await expect(api.createProfile(ownerA, { name: 'Municipio' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('con el flag: jerarquía que restringe, clave visible una sola vez, verificación y revocación', async () => {
      await prisma.featureFlag.create({ data: { organizationId: orgA, key: 'welver.api', enabled: true } });
      const entities = await orgChart.list(ownerA);
      const [e1, e2, e3] = entities;

      const root = await api.createProfile(ownerA, { name: 'Municipio', visibleEntityIds: [e1?.id ?? '', e2?.id ?? ''] });
      await expect(api.createProfile(ownerA, { name: 'Secretaría', parentId: root.id, visibleEntityIds: [e3?.id ?? ''] })).rejects.toThrow('padre');
      const child = await api.createProfile(ownerA, { name: 'Secretaría', parentId: root.id, visibleEntityIds: [e1?.id ?? ''] });
      await expect(api.updateProfile(ownerA, root.id, { parentId: child.id })).rejects.toThrow('sí mismo');

      const created = await api.createKey(ownerA, child.id, 'Sistema de turnos');
      expect(created.key.startsWith('wlv_')).toBe(true);
      const stored = await prisma.apiKey.findUniqueOrThrow({ where: { id: created.id } });
      expect(stored.keyHash).not.toContain(created.key); // solo el hash
      expect(JSON.stringify(await api.listKeys(ownerA))).not.toContain(created.key);

      expect(await api.verifyKey(created.key)).toMatchObject({ organizationId: orgA, profileId: child.id, visibleEntityIds: [e1?.id] });
      expect(await api.verifyKey('wlv_' + 'x'.repeat(43))).toBeNull();

      const rotated = await api.rotateKey(ownerA, created.id);
      expect(rotated.key).not.toBe(created.key);
      expect(await api.verifyKey(created.key)).toBeNull(); // la vieja ya no vale
      expect(await api.verifyKey(rotated.key)).not.toBeNull();

      await api.revokeKey(ownerA, rotated.id);
      expect(await api.verifyKey(rotated.key)).toBeNull();
      await expect(api.revokeKey(ownerA, rotated.id)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('AISLAMIENTO: otro municipio no ve perfiles ni claves; un colaborador no gestiona nada', async () => {
      expect(await api.listProfiles(ownerA)).not.toHaveLength(0);
      await expect(api.listProfiles(collabA)).rejects.toBeInstanceOf(ForbiddenException);
      await prisma.featureFlag.create({ data: { organizationId: orgB, key: 'welver.api', enabled: true } });
      expect(await api.listProfiles(ownerB)).toEqual([]);
      expect(await api.listKeys(ownerB)).toEqual([]);
    });

    it('un perfil con claves no se borra: se desactiva', async () => {
      const profile = await api.createProfile(ownerA, { name: 'Con clave' });
      await api.createKey(ownerA, profile.id, 'k');
      expect(await api.removeProfile(ownerA, profile.id)).toEqual({ removed: false, deactivated: true });
      const empty = await api.createProfile(ownerA, { name: 'Vacío' });
      expect(await api.removeProfile(ownerA, empty.id)).toEqual({ removed: true, deactivated: false });
    });
  });
});
