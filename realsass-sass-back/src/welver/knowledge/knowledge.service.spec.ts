import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { KnowledgeService } from '@/welver/knowledge/knowledge.service';
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
  ['hospital', { id: 'hospital', parentId: 'salud' }],
  ['obras', { id: 'obras', parentId: null }],
]);
const grant = (entityId: string, g: Partial<EntityGrant> = {}): [string, EntityGrant] => [
  entityId,
  { entityId, canView: true, canEdit: false, canApprove: false, canPublish: false, ...g },
];

function item(over: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    organizationId: ORG,
    entityId: 'hospital',
    title: 'Horarios',
    kind: 'TEXT',
    content: 'Lunes a viernes',
    fileName: null,
    fileUrl: null,
    fileSizeBytes: null,
    status: 'DRAFT',
    publishedVersion: 0,
    authorUid: 'owner',
    reviewerUid: null,
    reviewNote: null,
    indexedAt: null,
    archivedAt: null,
    ...over,
  };
}

function setup(opts: { item?: ReturnType<typeof item>; requiresApproval?: boolean; grants?: [string, EntityGrant][]; actorIsOwner?: boolean; writable?: boolean } = {}) {
  const current = opts.item ?? item();
  const tenant = {
    knowledgeItem: {
      findFirst: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...current, ...data })),
      create: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    knowledgeVersion: {
      create: jest.fn().mockImplementation(({ data }) => ({ op: 'createVersion', data })),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    municipalEntity: {
      findFirst: jest.fn().mockResolvedValue({ requiresApproval: opts.requiresApproval ?? false, archivedAt: null }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
  };
  tenant.knowledgeItem.update.mockImplementation(({ data }) => ({ op: 'updateItem', data }));
  const prisma = { forTenant: jest.fn().mockReturnValue(tenant) } as unknown as PrismaService;
  const access = {
    forActor: jest.fn().mockImplementation((actor: WelverActor) =>
      Promise.resolve(new EntityAccess(actor.role === 'OWNER' || opts.actorIsOwner === true, nodes, new Map(opts.grants ?? []))),
    ),
  } as unknown as EntityAccessService;
  const subscriptions = {
    assertWritable: opts.writable === false
      ? jest.fn().mockRejectedValue(new ForbiddenException('solo lectura'))
      : jest.fn().mockResolvedValue(undefined),
  } as unknown as SubscriptionService;
  return { service: new KnowledgeService(prisma, access, subscriptions), tenant, subscriptions };
}

describe('KnowledgeService — publicación', () => {
  it('sin aprobación: el dueño publica y se crea la versión 1', async () => {
    const { service, tenant } = setup();
    await service.publish(owner, 'i1');
    const [ops] = tenant.$transaction.mock.calls[0] as [{ op: string; data: Record<string, unknown> }[]];
    expect(ops[0]).toMatchObject({ op: 'createVersion', data: { version: 1, itemId: 'i1', content: 'Lunes a viernes', publishedBy: 'owner' } });
    expect(ops[1]).toMatchObject({ op: 'updateItem', data: { status: 'PUBLISHED', publishedVersion: 1, indexedAt: null } });
  });

  it('la versión siguiente suma 1 a la última publicada', async () => {
    const { service, tenant } = setup({ item: item({ status: 'DRAFT', publishedVersion: 4 }) });
    await service.publish(owner, 'i1');
    const [ops] = tenant.$transaction.mock.calls[0] as [{ data: Record<string, unknown> }[]];
    expect(ops[0]?.data['version']).toBe(5);
  });

  it('un colaborador que solo puede editar NO publica', async () => {
    const { service, tenant } = setup({ grants: [grant('salud', { canEdit: true })] });
    await expect(service.publish(collab, 'i1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenant.$transaction).not.toHaveBeenCalled();
  });

  it('un colaborador con «publicar» sobre el ente padre publica en sus áreas (herencia)', async () => {
    const { service, tenant } = setup({ grants: [grant('salud', { canPublish: true })] });
    await service.publish(collab, 'i1');
    expect(tenant.$transaction).toHaveBeenCalledTimes(1);
  });

  it('un colaborador sin permiso sobre otro ente recibe Forbidden, no datos', async () => {
    const { service } = setup({ item: item({ entityId: 'obras' }), grants: [grant('salud', { canPublish: true })] });
    await expect(service.publish(collab, 'i1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('con aprobación: no se publica un borrador sin revisión', async () => {
    const { service } = setup({ requiresApproval: true });
    await expect(service.publish(owner, 'i1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('con aprobación: quien tiene «aprobar» publica lo que está en revisión', async () => {
    const { service, tenant } = setup({ requiresApproval: true, item: item({ status: 'IN_REVIEW' }), grants: [grant('hospital', { canApprove: true })] });
    await service.publish(collab, 'i1');
    const [ops] = tenant.$transaction.mock.calls[0] as [{ data: Record<string, unknown> }[]];
    expect(ops[1]?.data).toMatchObject({ status: 'PUBLISHED', reviewerUid: 'collab' });
  });

  it('no se publica un dato vacío', async () => {
    const { service } = setup({ item: item({ content: '   ' }) });
    await expect(service.publish(owner, 'i1')).rejects.toThrow('no tiene contenido');
  });

  it('con el paquete suspendido el panel es de solo lectura: no se publica', async () => {
    const { service, tenant } = setup({ writable: false });
    await expect(service.publish(owner, 'i1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenant.$transaction).not.toHaveBeenCalled();
  });

  it('un dato inexistente es NotFound', async () => {
    const { service, tenant } = setup();
    tenant.knowledgeItem.findFirst.mockResolvedValue(null);
    await expect(service.publish(owner, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('KnowledgeService — edición y estados', () => {
  it('editar un dato publicado lo vuelve borrador y NO toca las versiones publicadas', async () => {
    const { service, tenant } = setup({ item: item({ status: 'PUBLISHED', publishedVersion: 2 }) });
    await service.update(owner, 'i1', { content: 'Nuevo texto' });
    expect(tenant.knowledgeItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT', content: 'Nuevo texto' }) }),
    );
    expect(tenant.knowledgeVersion.create).not.toHaveBeenCalled();
  });

  it('un dato archivado no se edita', async () => {
    const { service } = setup({ item: item({ status: 'ARCHIVED' }) });
    await expect(service.update(owner, 'i1', { title: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('enviar a revisión solo existe en entes con aprobación', async () => {
    const direct = setup();
    await expect(direct.service.act(owner, 'i1', 'submit')).rejects.toBeInstanceOf(ConflictException);
    const reviewed = setup({ requiresApproval: true });
    await reviewed.service.act(owner, 'i1', 'submit');
    expect(reviewed.tenant.knowledgeItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'IN_REVIEW' }) }));
  });

  it('rechazar guarda la nota y quién rechazó', async () => {
    const { service, tenant } = setup({ requiresApproval: true, item: item({ status: 'IN_REVIEW' }) });
    await service.act(owner, 'i1', 'reject', 'Falta el horario de guardia');
    expect(tenant.knowledgeItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT', reviewerUid: 'owner', reviewNote: 'Falta el horario de guardia' }) }),
    );
  });

  it('restaurar una versión la trae como borrador, sin publicarla', async () => {
    const { service, tenant } = setup({ item: item({ status: 'PUBLISHED', publishedVersion: 3 }) });
    tenant.knowledgeVersion.findFirst.mockResolvedValue({ title: 'Viejo', kind: 'TEXT', content: 'Texto v1', fileName: null, fileUrl: null });
    await service.restoreVersion(owner, 'i1', 1);
    expect(tenant.knowledgeItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'Viejo', content: 'Texto v1', status: 'DRAFT' }) }),
    );
    expect(tenant.knowledgeVersion.create).not.toHaveBeenCalled();
  });
});

describe('KnowledgeService — importación CSV', () => {
  function withEntities() {
    const ctx = setup({ grants: [grant('salud', { canEdit: true })] });
    ctx.tenant.municipalEntity.findMany.mockResolvedValue([
      { id: 'salud', parentId: null, name: 'Salud' },
      { id: 'hospital', parentId: 'salud', name: 'Hospital' },
      { id: 'obras', parentId: null, name: 'Obras' },
    ]);
    return ctx;
  }

  it('dryRun valida sin crear nada', async () => {
    const { service, tenant } = withEntities();
    const r = await service.importCsv(collab, 'ente,titulo,contenido\nHospital,Horarios,Lunes a viernes', true);
    expect(r).toMatchObject({ dryRun: true, created: 0, errors: [] });
    expect(r.rows).toHaveLength(1);
    expect(tenant.knowledgeItem.createMany).not.toHaveBeenCalled();
  });

  it('crea borradores en los entes indicados (por nombre o por camino)', async () => {
    const { service, tenant } = withEntities();
    const r = await service.importCsv(owner, 'ente,titulo,contenido\nHospital,Horarios,L a V\nSalud > Hospital,Guardia,24 h', false);
    expect(r).toMatchObject({ created: 2, errors: [] });
    expect(tenant.knowledgeItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ entityId: 'hospital', title: 'Horarios', authorUid: 'owner' }),
        expect.objectContaining({ entityId: 'hospital', title: 'Guardia' }),
      ],
    });
  });

  it('todo o nada: si una fila falla no se crea ninguna', async () => {
    const { service, tenant } = withEntities();
    const r = await service.importCsv(owner, 'ente,titulo,contenido\nHospital,Bien,ok\nInexistente,Mal,ok', false);
    expect(r.created).toBe(0);
    expect(r.errors).toEqual([{ line: 3, message: 'No existe el ente «Inexistente»' }]);
    expect(tenant.knowledgeItem.createMany).not.toHaveBeenCalled();
  });

  it('un colaborador no carga en un ente donde no puede editar', async () => {
    const { service } = withEntities();
    const r = await service.importCsv(collab, 'ente,titulo,contenido\nObras,Permisos,x', true);
    expect(r.errors[0]?.message).toContain('No tenés permiso');
  });

  it('un nombre repetido pide el camino completo', async () => {
    const ctx = setup();
    ctx.tenant.municipalEntity.findMany.mockResolvedValue([
      { id: 'a', parentId: null, name: 'Cultura' },
      { id: 'b', parentId: 'a', name: 'Cultura' },
    ]);
    const r = await ctx.service.importCsv(owner, 'ente,titulo,contenido\nCultura,x,y', true);
    expect(r.errors[0]?.message).toContain('más de un ente');
  });
});
