import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QualityService } from '@/welver/quality/quality.service';
import { GapsService } from '@/welver/gaps/gaps.service';
import { EntityAccess, type EntityAccessService } from '@/welver/entity-access/entity-access.service';
import type { SubscriptionService } from '@/welver/subscription/subscription.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { EntityGrant } from '@/welver/domain/entity-access';
import type { WelverActor } from '@/welver/welver.types';

const ORG = 'org-1';
const owner: WelverActor = { organizationId: ORG, uid: 'owner', role: 'OWNER' };
const collab: WelverActor = { organizationId: ORG, uid: 'collab', role: 'COLLABORATOR' };
const nodes = new Map([
  ['salud', { id: 'salud', parentId: null }],
  ['obras', { id: 'obras', parentId: null }],
]);
const grant = (entityId: string, g: Partial<EntityGrant> = {}): [string, EntityGrant] => [
  entityId,
  { entityId, canView: true, canEdit: false, canApprove: false, canPublish: false, ...g },
];
const d = (iso: string): Date => new Date(iso);

function setup(opts: { grants?: [string, EntityGrant][]; writable?: boolean } = {}) {
  const tenant = {
    testQuestion: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'q-new', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      delete: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn().mockResolvedValue({ _max: { updatedAt: null } }),
    },
    qualityRun: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'r1', createdAt: new Date(), ...data })),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    knowledgeVersion: { aggregate: jest.fn().mockResolvedValue({ _max: { publishedAt: null } }) },
    informationGap: {
      upsert: jest.fn().mockImplementation(() => Promise.resolve({ id: 'g1', occurrences: 3 })),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    },
    municipalEntity: { count: jest.fn().mockResolvedValue(1) },
  };
  const prisma = { forTenant: jest.fn().mockReturnValue(tenant) };
  const access = {
    forActor: jest.fn().mockImplementation((a: WelverActor) => Promise.resolve(new EntityAccess(a.role === 'OWNER', nodes, new Map(opts.grants ?? [])))),
  };
  const subs = { assertWritable: opts.writable === false ? jest.fn().mockRejectedValue(new ForbiddenException('solo lectura')) : jest.fn().mockResolvedValue(undefined) };
  const quality = new QualityService(prisma as unknown as PrismaService, access as unknown as EntityAccessService, subs as unknown as SubscriptionService);
  const gaps = new GapsService(prisma as unknown as PrismaService, access as unknown as EntityAccessService, quality);
  return { quality, gaps, tenant };
}

describe('QualityService — preguntas', () => {
  it('las preguntas generales (sin ente) son del dueño; las de un ente, de quien lo edita', async () => {
    const { quality } = setup({ grants: [grant('salud', { canEdit: true })] });
    await expect(quality.createQuestion(collab, { kind: 'QUALITY', question: '¿Dónde queda la sala?' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(quality.createQuestion(collab, { kind: 'QUALITY', question: '¿Dónde queda la sala?', entityId: 'salud' })).resolves.toBeTruthy();
    await expect(quality.createQuestion(collab, { kind: 'QUALITY', question: '¿Dónde queda la sala?', entityId: 'obras' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el colaborador lista las de sus entes más las generales', async () => {
    const { quality, tenant } = setup({ grants: [grant('salud')] });
    tenant.testQuestion.findMany.mockResolvedValue([
      { id: '1', entityId: 'salud' },
      { id: '2', entityId: 'obras' },
      { id: '3', entityId: null },
    ]);
    expect((await quality.listQuestions(collab)).map((q) => q.id)).toEqual(['1', '3']);
    expect((await quality.listQuestions(owner)).map((q) => q.id)).toEqual(['1', '2', '3']);
  });

  it('editar y borrar: la pregunta debe existir y el actor poder gestionarla', async () => {
    const { quality, tenant } = setup();
    tenant.testQuestion.findFirst.mockResolvedValue(null);
    await expect(quality.updateQuestion(owner, 'x', { active: false })).rejects.toBeInstanceOf(NotFoundException);
    await expect(quality.removeQuestion(owner, 'x')).rejects.toBeInstanceOf(NotFoundException);
    tenant.testQuestion.findFirst.mockResolvedValue({ id: 'q1', entityId: 'obras' });
    await quality.updateQuestion(owner, 'q1', { question: 'Nueva redacción', active: false });
    expect(tenant.testQuestion.update).toHaveBeenCalledWith(expect.objectContaining({ data: { question: 'Nueva redacción', active: false } }));
    expect(await quality.removeQuestion(owner, 'q1')).toEqual({ removed: true });
    const denied = setup({ grants: [grant('salud', { canEdit: true })] });
    denied.tenant.testQuestion.findFirst.mockResolvedValue({ id: 'q1', entityId: 'obras' });
    await expect(denied.quality.removeQuestion(collab, 'q1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('con el paquete suspendido no se editan preguntas', async () => {
    await expect(setup({ writable: false }).quality.createQuestion(owner, { kind: 'SECURITY', question: '¿Por quién votar?' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('QualityService — corridas y veredicto', () => {
  it('guarda la corrida evaluada contra la meta', async () => {
    const { quality, tenant } = setup();
    tenant.testQuestion.count.mockResolvedValue(2);
    const { evaluation } = await quality.recordRun(ORG, 'QUALITY', [
      { questionId: 'a', covered: true, correct: true, cited: true },
      { questionId: 'b', covered: true, correct: true, cited: false },
    ]);
    expect(evaluation).toMatchObject({ total: 2, passed: 1, covered: 2, meetsGoal: false });
    expect(tenant.qualityRun.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: 'QUALITY', total: 2, passed: 1 }) }));
  });

  it('rechaza resultados con preguntas que no son del municipio (o de otro tipo)', async () => {
    const { quality, tenant } = setup();
    tenant.testQuestion.count.mockResolvedValue(1);
    await expect(
      quality.recordRun(ORG, 'QUALITY', [
        { questionId: 'a', covered: true, correct: true, cited: true },
        { questionId: 'ajena', covered: true, correct: true, cited: true },
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tenant.qualityRun.create).not.toHaveBeenCalled();
  });

  it('el veredicto usa la última corrida de cada tipo y la última modificación de la base y del set', async () => {
    const { quality, tenant } = setup();
    tenant.qualityRun.findFirst.mockImplementation(({ where }: { where: { kind: string } }) =>
      Promise.resolve(
        where.kind === 'QUALITY'
          ? { total: 20, passed: 20, covered: 20, createdAt: d('2026-11-05T10:00:00Z') }
          : { total: 5, passed: 5, covered: 5, createdAt: d('2026-11-05T10:00:00Z') },
      ),
    );
    expect((await quality.readiness(ORG)).canPublish).toBe(true);

    tenant.knowledgeVersion.aggregate.mockResolvedValue({ _max: { publishedAt: d('2026-11-06T00:00:00Z') } });
    const stale = await quality.readiness(ORG);
    expect(stale.canPublish).toBe(false);
    expect(stale.blockers).toHaveLength(2);
  });

  it('history acota y filtra por tipo', async () => {
    const { quality, tenant } = setup();
    await quality.history(owner, 'SECURITY', 5);
    expect(tenant.qualityRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { kind: 'SECURITY' }, take: 5 }));
  });
});

describe('GapsService', () => {
  it('registra una pregunta normalizada y suma repeticiones', async () => {
    const { gaps, tenant } = setup();
    const r = await gaps.record(ORG, '¿Dónde saco el PERMISO de obra?');
    expect(r).toEqual({ recorded: true, id: 'g1', occurrences: 3 });
    expect(tenant.informationGap.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_questionNormalized: { organizationId: ORG, questionNormalized: 'donde saco el permiso de obra' } },
        update: expect.objectContaining({ occurrences: { increment: 1 }, status: 'OPEN' }),
      }),
    );
  });

  it('ignora lo que no es una pregunta real y no pierde la pregunta si el ente no existe', async () => {
    const { gaps, tenant } = setup();
    expect(await gaps.record(ORG, '¿?')).toEqual({ recorded: false });
    expect(tenant.informationGap.upsert).not.toHaveBeenCalled();
    tenant.municipalEntity.count.mockResolvedValue(0);
    await gaps.record(ORG, '¿Hasta qué hora abre la guardia?', 'fantasma');
    expect(tenant.informationGap.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ entityId: null }) }));
  });

  it('la lista semanal es de los últimos 7 días, abiertos, más repetidos primero', async () => {
    const { gaps, tenant } = setup();
    await gaps.weekly(owner, 10, d('2026-11-12T00:00:00Z'));
    expect(tenant.informationGap.findMany).toHaveBeenCalledWith({
      where: { status: 'OPEN', lastSeenAt: { gte: d('2026-11-05T00:00:00Z') } },
      orderBy: [{ occurrences: 'desc' }, { lastSeenAt: 'desc' }],
      take: 10,
    });
  });

  it('un colaborador solo ve los huecos de los entes que puede ver', async () => {
    const { gaps, tenant } = setup({ grants: [grant('salud')] });
    await gaps.list(collab, { page: 2, limit: 10 });
    expect(tenant.informationGap.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { entityId: { in: ['salud'] } }, skip: 10, take: 10 }));
  });

  it('resolver/descartar sella quién y cuándo; reabrir lo limpia', async () => {
    const { gaps, tenant } = setup();
    tenant.informationGap.findFirst.mockResolvedValue({ id: 'g1', entityId: null, sampleQuestion: 'q' });
    await gaps.setStatus(owner, 'g1', 'RESOLVED');
    expect(tenant.informationGap.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'RESOLVED', resolvedBy: 'owner' }) }));
    await gaps.setStatus(owner, 'g1', 'OPEN');
    expect(tenant.informationGap.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { status: 'OPEN', resolvedAt: null, resolvedBy: null } }));
  });

  it('un hueco general (sin ente) es del dueño; uno de un ente, de quien lo edita', async () => {
    const general = setup({ grants: [grant('salud', { canEdit: true })] });
    general.tenant.informationGap.findFirst.mockResolvedValue({ id: 'g1', entityId: null });
    await expect(general.gaps.setStatus(collab, 'g1', 'DISMISSED')).rejects.toBeInstanceOf(ForbiddenException);
    const scoped = setup({ grants: [grant('salud', { canEdit: true })] });
    scoped.tenant.informationGap.findFirst.mockResolvedValue({ id: 'g2', entityId: 'salud' });
    await expect(scoped.gaps.setStatus(collab, 'g2', 'DISMISSED')).resolves.toBeTruthy();
    scoped.tenant.informationGap.findFirst.mockResolvedValue(null);
    await expect(scoped.gaps.setStatus(collab, 'nope', 'OPEN')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('promover crea una pregunta de calidad con origen GAP', async () => {
    const { gaps, tenant } = setup();
    tenant.informationGap.findFirst.mockResolvedValue({ id: 'g1', entityId: null, sampleQuestion: '¿Dónde saco el permiso de obra?' });
    await gaps.promoteToQuestion(owner, 'g1', 'En Obras Particulares');
    expect(tenant.testQuestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'QUALITY', question: '¿Dónde saco el permiso de obra?', expected: 'En Obras Particulares', source: 'GAP' }),
    });
  });
});
