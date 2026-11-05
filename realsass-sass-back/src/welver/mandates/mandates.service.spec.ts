import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MandatesService } from '@/welver/mandates/mandates.service';
import { EntityAccess, type EntityAccessService } from '@/welver/entity-access/entity-access.service';
import type { SubscriptionService } from '@/welver/subscription/subscription.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { WelverActor } from '@/welver/welver.types';
import { buildSnapshot } from '@/welver/domain/mandate-snapshot';

const ORG = 'org-1';
const owner: WelverActor = { organizationId: ORG, uid: 'owner', role: 'OWNER' };
const collab: WelverActor = { organizationId: ORG, uid: 'collab', role: 'COLLABORATOR' };
const now = new Date('2026-11-05T10:00:00Z');

const entity = (id: string, parentId: string | null, archivedAt: Date | null = null) => ({
  id,
  parentId,
  name: id.toUpperCase(),
  description: null,
  sortOrder: 0,
  requiresApproval: false,
  archivedAt,
});

/** Snapshot guardado del mandato anterior: salud › hospital, y un dato publicado en v2 en el hospital. */
const savedSnapshot = buildSnapshot(
  {
    entities: [entity('salud', null), entity('hospital', 'salud')],
    links: [{ fromEntityId: 'salud', toEntityId: 'hospital', label: null }],
    versions: [{ itemId: 'i1', entityId: 'hospital', version: 2, title: 'Horarios 2022', kind: 'TEXT', content: 'Texto del mandato anterior', fileName: null, fileUrl: null }],
  },
  now,
);

function setup(opts: { snapshot?: unknown; writable?: boolean; liveEntities?: string[]; liveItems?: { id: string; publishedVersion: number }[] } = {}) {
  const calls: string[] = [];
  const tx = {
    municipalEntity: {
      findMany: jest.fn().mockResolvedValue((opts.liveEntities ?? ['salud', 'hospital', 'nuevo']).map((id) => ({ id }))),
      update: jest.fn().mockImplementation(({ where }) => calls.push(`entity.update:${where.id}`)),
      create: jest.fn().mockImplementation(({ data }) => calls.push(`entity.create:${data.id}`)),
      updateMany: jest.fn().mockImplementation(({ where }) => calls.push(`entity.archive:${where.id.in.join(',')}`)),
    },
    knowledgeItem: {
      findMany: jest.fn().mockResolvedValue(opts.liveItems ?? [{ id: 'i1', publishedVersion: 5 }, { id: 'i-nuevo', publishedVersion: 1 }]),
      update: jest.fn().mockImplementation(({ where, data }) => calls.push(`item.update:${where.id}:v${data.publishedVersion}`)),
      create: jest.fn().mockImplementation(({ data }) => calls.push(`item.create:${data.id}:v${data.publishedVersion}`)),
      updateMany: jest.fn().mockImplementation(({ where }) => calls.push(`item.archive:${where.id.in.join(',')}`)),
    },
    knowledgeVersion: { create: jest.fn().mockImplementation(({ data }) => calls.push(`version.create:${data.itemId}:v${data.version}`)) },
    entityLink: {
      deleteMany: jest.fn().mockImplementation(() => calls.push('links.deleteAll')),
      createMany: jest.fn().mockImplementation(({ data }) => calls.push(`links.create:${data.length}`)),
    },
    mandate: {
      updateMany: jest.fn().mockImplementation(() => calls.push('mandate.deactivateAll')),
      update: jest.fn().mockImplementation(({ where, data }) => calls.push(`mandate.update:${where.id}:${data.status}`)),
    },
  };
  const tenant = {
    mandate: {
      findFirst: jest.fn().mockResolvedValue({ id: 'm1', name: 'Gestión 2019-2023', status: 'ARCHIVED', startsAt: null, endsAt: null, snapshot: opts.snapshot ?? savedSnapshot }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'nuevo-m', ...data })),
      update: jest.fn(),
      delete: jest.fn(),
    },
    municipalEntity: { findMany: jest.fn().mockResolvedValue([entity('salud', null), entity('hospital', 'salud'), entity('nuevo', null)]) },
    entityLink: { findMany: jest.fn().mockResolvedValue([]) },
    knowledgeItem: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', entityId: 'hospital', publishedVersion: 5 }]) },
    knowledgeVersion: { findMany: jest.fn().mockResolvedValue([{ itemId: 'i1', version: 5, title: 'Horarios 2026', kind: 'TEXT', content: 'Texto vigente', fileName: null, fileUrl: null }]) },
    $transaction: jest.fn().mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  const prisma = { forTenant: jest.fn().mockReturnValue(tenant) };
  const access = {
    forActor: jest.fn().mockImplementation((actor: WelverActor) => Promise.resolve(new EntityAccess(actor.role === 'OWNER', new Map(), new Map()))),
  };
  const subscriptions = {
    assertWritable: opts.writable === false ? jest.fn().mockRejectedValue(new ForbiddenException('solo lectura')) : jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn() };
  const service = new MandatesService(
    prisma as unknown as PrismaService,
    access as unknown as EntityAccessService,
    subscriptions as unknown as SubscriptionService,
    audit as unknown as ConfigAuditService,
  );
  return { service, tenant, tx, calls, audit };
}

describe('MandatesService.restore', () => {
  it('toma una foto de seguridad del estado actual ANTES de tocar nada', async () => {
    const { service, tenant } = setup();
    const result = await service.restore(owner, 'm1');

    const backup = tenant.mandate.create.mock.calls[0]?.[0] as { data: { name: string; status: string; snapshot: { knowledge: { content: string }[] } } };
    expect(backup.data.name).toBe('Antes de restaurar «Gestión 2019-2023»');
    expect(backup.data.status).toBe('ARCHIVED');
    expect(backup.data.snapshot.knowledge[0]?.content).toBe('Texto vigente'); // lo que estaba en uso, no lo restaurado
    expect(result.backupMandateId).toBe('nuevo-m');
    expect(tenant.mandate.create.mock.invocationCallOrder[0]).toBeLessThan(tenant.$transaction.mock.invocationCallOrder[0] ?? 0);
  });

  it('restaura el organigrama conservando ids: padres primero, y archiva lo que no estaba', async () => {
    const { service, calls } = setup();
    await service.restore(owner, 'm1');
    expect(calls.indexOf('entity.update:salud')).toBeLessThan(calls.indexOf('entity.update:hospital'));
    expect(calls).toContain('entity.archive:nuevo');
  });

  it('un ente del snapshot que ya no existe se recrea con su mismo id', async () => {
    const { service, calls } = setup({ liveEntities: ['salud'] });
    await service.restore(owner, 'm1');
    expect(calls).toContain('entity.create:hospital');
    expect(calls).toContain('entity.update:salud');
  });

  it('los vínculos se reemplazan por completo', async () => {
    const { service, calls } = setup();
    await service.restore(owner, 'm1');
    expect(calls.indexOf('links.deleteAll')).toBeLessThan(calls.indexOf('links.create:1'));
  });

  it('el conocimiento vuelve como una versión NUEVA (la 6), sin reescribir el historial', async () => {
    const { service, calls, tx } = setup();
    await service.restore(owner, 'm1');
    expect(calls).toContain('item.update:i1:v6');
    expect(calls).toContain('version.create:i1:v6');
    expect(tx.knowledgeVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemId: 'i1', version: 6, content: 'Texto del mandato anterior', publishedBy: 'owner' }),
    });
    expect(calls).toContain('item.archive:i-nuevo'); // lo que no estaba en el mandato se archiva
  });

  it('un dato que ya no existe se recrea con su id y empieza en la versión 1', async () => {
    const { service, calls } = setup({ liveItems: [] });
    await service.restore(owner, 'm1');
    expect(calls).toContain('item.create:i1:v1');
    expect(calls).toContain('version.create:i1:v1');
  });

  it('el mandato restaurado queda en uso y los demás, archivados', async () => {
    const { service, calls } = setup();
    await service.restore(owner, 'm1');
    expect(calls.indexOf('mandate.deactivateAll')).toBeLessThan(calls.indexOf('mandate.update:m1:ACTIVE'));
  });

  it('se audita', async () => {
    const { service, audit } = setup();
    await service.restore(owner, 'm1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ configType: 'mandate', action: 'restore', diff: { backupId: 'nuevo-m' } }));
  });

  it('una foto dañada o de otra versión se rechaza ANTES de tomar la copia de seguridad o tocar datos', async () => {
    const { service, tenant } = setup({ snapshot: { schemaVersion: 99 } });
    await expect(service.restore(owner, 'm1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tenant.mandate.create).not.toHaveBeenCalled();
    expect(tenant.$transaction).not.toHaveBeenCalled();
  });

  it('solo el dueño; y con el paquete suspendido, nadie', async () => {
    await expect(setup().service.restore(collab, 'm1')).rejects.toBeInstanceOf(ForbiddenException);
    const suspended = setup({ writable: false });
    await expect(suspended.service.restore(owner, 'm1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(suspended.tenant.$transaction).not.toHaveBeenCalled();
  });

  it('un mandato inexistente es NotFound', async () => {
    const { service, tenant } = setup();
    tenant.mandate.findFirst.mockResolvedValue(null);
    await expect(service.restore(owner, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MandatesService — resto', () => {
  it('create guarda una foto ARCHIVED (copia de seguridad, no cambia lo que está en uso)', async () => {
    const { service, tenant } = setup();
    const r = await service.create(owner, { name: 'Gestión 2023-2027' });
    expect(tenant.mandate.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: 'Gestión 2023-2027', status: 'ARCHIVED', createdBy: 'owner' }) });
    expect(r.summary).toMatchObject({ entities: 3, knowledge: 1 });
  });

  it('duplicate copia la foto con otro nombre', async () => {
    const { service, tenant } = setup();
    await service.duplicate(owner, 'm1', 'Copia');
    expect(tenant.mandate.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: 'Copia', status: 'ARCHIVED', snapshot: expect.objectContaining({ schemaVersion: 1 }) }) });
  });

  it('no se elimina el mandato en uso', async () => {
    const { service, tenant } = setup();
    tenant.mandate.findFirst.mockResolvedValue({ id: 'm1', name: 'x', status: 'ACTIVE', snapshot: savedSnapshot });
    await expect(service.remove(owner, 'm1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tenant.mandate.delete).not.toHaveBeenCalled();
  });

  it('list solo para el dueño y sin enviar el contenido de la foto', async () => {
    await expect(setup().service.list(collab)).rejects.toBeInstanceOf(ForbiddenException);
    const { service, tenant } = setup();
    tenant.mandate.findMany.mockResolvedValue([{ id: 'm1', name: 'A', status: 'ARCHIVED', startsAt: null, endsAt: null, createdAt: now, createdBy: 'owner', snapshot: savedSnapshot }]);
    const [first] = await service.list(owner);
    expect(first).not.toHaveProperty('snapshot');
    expect(first?.summary).toMatchObject({ entities: 2, knowledge: 1 });
  });
});
