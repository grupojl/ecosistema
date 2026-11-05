import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrgChartService } from '@/welver/org-chart/org-chart.service';
import { EntityAccess, type EntityAccessService } from '@/welver/entity-access/entity-access.service';
import type { SubscriptionService } from '@/welver/subscription/subscription.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { EntityGrant } from '@/welver/domain/entity-access';
import type { WelverActor } from '@/welver/welver.types';
import { ORG_CHART_TEMPLATES, flattenTemplate } from '@/welver/domain/org-chart-templates';

const ORG = 'org-1';
const owner: WelverActor = { organizationId: ORG, uid: 'owner', role: 'OWNER' };
const collab: WelverActor = { organizationId: ORG, uid: 'collab', role: 'COLLABORATOR' };

const row = (id: string, parentId: string | null, name = id, archivedAt: Date | null = null) => ({
  id,
  parentId,
  name,
  description: null,
  sortOrder: 0,
  requiresApproval: false,
  archivedAt,
});
// salud ─ hospital ─ guardia      obras
const rows = [row('salud', null, 'Salud'), row('hospital', 'salud', 'Hospital'), row('guardia', 'hospital', 'Guardia'), row('obras', null, 'Obras')];
const grant = (entityId: string, g: Partial<EntityGrant> = {}): [string, EntityGrant] => [
  entityId,
  { entityId, canView: true, canEdit: false, canApprove: false, canPublish: false, ...g },
];

function setup(opts: { grants?: [string, EntityGrant][]; entities?: ReturnType<typeof row>[]; writable?: boolean } = {}) {
  const entities = opts.entities ?? rows;
  const tenant = {
    municipalEntity: {
      findMany: jest.fn().mockImplementation(({ where }: { where?: { parentId?: string | null } } = {}) =>
        Promise.resolve(where && 'parentId' in where ? entities.filter((e) => e.parentId === where.parentId) : entities),
      ),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(entities.find((e) => e.id === where.id) ?? null)),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 2 } }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'nuevo', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      updateMany: jest.fn().mockImplementation((args) => ({ op: 'entities', args })),
      createMany: jest.fn().mockImplementation((args) => ({ op: 'createMany', args })),
      count: jest.fn().mockResolvedValue(entities.length),
    },
    knowledgeItem: { updateMany: jest.fn().mockImplementation((args) => ({ op: 'knowledge', args })) },
    entityChannel: { updateMany: jest.fn().mockImplementation((args) => ({ op: 'channels', args })) },
    entityLink: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
  };
  const prisma = { forTenant: jest.fn().mockReturnValue(tenant), organization: { update: jest.fn() } };
  const access = {
    forActor: jest.fn().mockImplementation((actor: WelverActor) =>
      Promise.resolve(new EntityAccess(actor.role === 'OWNER', new Map(entities.map((e) => [e.id, e])), new Map(opts.grants ?? []))),
    ),
  };
  const subscriptions = {
    assertWritable: opts.writable === false ? jest.fn().mockRejectedValue(new ForbiddenException('solo lectura')) : jest.fn().mockResolvedValue(undefined),
  };
  const service = new OrgChartService(prisma as unknown as PrismaService, access as unknown as EntityAccessService, subscriptions as unknown as SubscriptionService);
  return { service, tenant, prisma };
}

describe('OrgChartService.list', () => {
  it('el dueño ve todo el árbol en orden, con nivel y camino', async () => {
    const list = await setup().service.list(owner);
    expect(list.map((e) => e.id)).toEqual(['obras', 'salud', 'hospital', 'guardia']);
    expect(list.find((e) => e.id === 'guardia')).toMatchObject({ depth: 3, path: 'Salud › Hospital › Guardia', exceedsSuggestedDepth: false });
  });

  it('un colaborador solo ve su rama (y lo que puede hacer en ella)', async () => {
    const list = await setup({ grants: [grant('hospital', { canEdit: true })] }).service.list(collab);
    expect(list.map((e) => e.id)).toEqual(['hospital', 'guardia']);
    expect(list[0]?.permissions).toEqual({ view: true, edit: true, approve: false, publish: false });
  });

  it('un colaborador sin asignaciones no ve nada', async () => {
    expect(await setup().service.list(collab)).toEqual([]);
  });

  it('los archivados no salen salvo que se pidan', async () => {
    const entities = [...rows, row('viejo', null, 'Viejo', new Date())];
    expect((await setup({ entities }).service.list(owner)).map((e) => e.id)).not.toContain('viejo');
    expect((await setup({ entities }).service.list(owner, { includeArchived: true })).map((e) => e.id)).toContain('viejo');
  });

  it('avisa (sin bloquear) al pasar los 5 niveles', async () => {
    const deep = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i, arr) => row(id, i === 0 ? null : (arr[i - 1] ?? null)));
    const list = await setup({ entities: deep }).service.list(owner);
    expect(list.find((e) => e.id === 'e')?.exceedsSuggestedDepth).toBe(false);
    expect(list.find((e) => e.id === 'f')?.exceedsSuggestedDepth).toBe(true);
  });
});

describe('OrgChartService.create', () => {
  it('crear una raíz es del dueño', async () => {
    await expect(setup({ grants: [grant('salud', { canEdit: true })] }).service.create(collab, { name: 'Nueva' })).rejects.toBeInstanceOf(ForbiddenException);
    const { service, tenant } = setup();
    await service.create(owner, { name: 'Nueva' });
    expect(tenant.municipalEntity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Nueva', parentId: null, sortOrder: 3 }) }));
  });

  it('un colaborador con «editar» crea hijos dentro de su rama, y solo ahí', async () => {
    const { service, tenant } = setup({ grants: [grant('salud', { canEdit: true })] });
    await service.create(collab, { name: 'Vacunación', parentId: 'salud' });
    expect(tenant.municipalEntity.create).toHaveBeenCalled();
    await expect(service.create(collab, { name: 'Nueva', parentId: 'obras' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no repite nombres entre hermanos (ignora mayúsculas y tildes)', async () => {
    const { service } = setup();
    await expect(service.create(owner, { name: '  hospital ', parentId: 'salud' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('no se crea dentro de un ente archivado ni de uno inexistente', async () => {
    const entities = [row('viejo', null, 'Viejo', new Date())];
    await expect(setup({ entities }).service.create(owner, { name: 'X', parentId: 'viejo' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup().service.create(owner, { name: 'X', parentId: 'fantasma' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('con el paquete suspendido es solo lectura', async () => {
    const { service, tenant } = setup({ writable: false });
    await expect(service.create(owner, { name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenant.municipalEntity.create).not.toHaveBeenCalled();
  });
});

describe('OrgChartService.update', () => {
  it('un colaborador renombra su ente pero no lo mueve ni cambia la aprobación', async () => {
    const { service, tenant } = setup({ grants: [grant('hospital', { canEdit: true })] });
    await service.update(collab, 'hospital', { name: 'Hospital Central' });
    expect(tenant.municipalEntity.update).toHaveBeenCalled();
    await expect(service.update(collab, 'hospital', { parentId: 'obras' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update(collab, 'hospital', { requiresApproval: true })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mover un ente bajo su propio descendiente se rechaza (ciclo)', async () => {
    await expect(setup().service.update(owner, 'salud', { parentId: 'guardia' })).rejects.toThrow('sí mismo');
  });

  it('mover a otro lugar válido funciona', async () => {
    const { service, tenant } = setup();
    await service.update(owner, 'hospital', { parentId: 'obras' });
    expect(tenant.municipalEntity.update).toHaveBeenCalledWith(expect.objectContaining({ data: { parentId: 'obras' } }));
  });

  it('no se mueve a un ente archivado', async () => {
    const entities = [...rows, row('viejo', null, 'Viejo', new Date())];
    await expect(setup({ entities }).service.update(owner, 'hospital', { parentId: 'viejo' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un ente que no existe es NotFound (no Forbidden: no se filtra qué ids existen)', async () => {
    await expect(setup().service.update(collab, 'fantasma', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrgChartService.archive', () => {
  it('archiva el ente y todo su subárbol, con sus datos, y pausa sus canales', async () => {
    const { service, tenant } = setup();
    expect(await service.archive(owner, 'salud')).toEqual({ archivedEntities: 3 });
    const [ops] = tenant.$transaction.mock.calls[0] as [{ op: string; args: { where: { id?: { in: string[] }; entityId?: { in: string[] } } } }[]];
    expect(ops[0]?.args.where.id?.in.sort()).toEqual(['guardia', 'hospital', 'salud']);
    expect(ops.map((o) => o.op)).toEqual(['entities', 'knowledge', 'channels']);
    expect(ops[1]?.args.where.entityId?.in.sort()).toEqual(['guardia', 'hospital', 'salud']);
  });

  it('solo el dueño archiva', async () => {
    await expect(setup({ grants: [grant('salud', { canEdit: true })] }).service.archive(collab, 'hospital')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('OrgChartService.restore', () => {
  it('no restaura bajo un padre archivado', async () => {
    const entities = [row('p', null, 'P', new Date()), row('h', 'p', 'H', new Date())];
    await expect(setup({ entities }).service.restore(owner, 'h')).rejects.toThrow('padre');
  });

  it('restaura un ente archivado cuyo padre está activo', async () => {
    const entities = [row('p', null, 'P'), row('h', 'p', 'H', new Date())];
    const { service, tenant } = setup({ entities });
    await service.restore(owner, 'h');
    expect(tenant.municipalEntity.update).toHaveBeenCalledWith(expect.objectContaining({ data: { archivedAt: null } }));
  });
});

describe('OrgChartService.applyTemplate', () => {
  it('solo se aplica a un organigrama vacío', async () => {
    await expect(setup().service.applyTemplate(owner, 'small')).rejects.toBeInstanceOf(ConflictException);
  });

  it('crea toda la plantilla con padres antes que hijos y ids consistentes', async () => {
    const { service, tenant, prisma } = setup({ entities: [] });
    tenant.municipalEntity.count.mockResolvedValue(0);
    const result = await service.applyTemplate(owner, 'medium');
    const expected = flattenTemplate(ORG_CHART_TEMPLATES.medium).length;
    expect(result.created).toBe(expected);

    const [ops] = tenant.$transaction.mock.calls[0] as [{ args: { data: { id: string; parentId: string | null }[] } }[]];
    const data = ops[0]?.args.data ?? [];
    expect(data).toHaveLength(expected);
    const seen = new Set<string>();
    for (const e of data) {
      if (e.parentId !== null) expect(seen.has(e.parentId)).toBe(true); // el padre ya fue listado
      seen.add(e.id);
    }
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: ORG }, data: { orgChartTemplate: 'medium' } });
  });
});

describe('OrgChartService.link', () => {
  it('no vincula un ente consigo mismo ni repite el vínculo (en cualquier sentido)', async () => {
    const { service, tenant } = setup();
    await expect(service.link(owner, 'salud', 'salud')).rejects.toBeInstanceOf(BadRequestException);
    tenant.entityLink.findFirst.mockResolvedValue({ id: 'l1' });
    await expect(service.link(owner, 'salud', 'obras')).rejects.toBeInstanceOf(ConflictException);
  });

  it('crea el vínculo si el actor puede editar el origen', async () => {
    const { service, tenant } = setup({ grants: [grant('salud', { canEdit: true })] });
    await service.link(collab, 'salud', 'obras', 'Programa conjunto');
    expect(tenant.entityLink.create).toHaveBeenCalledWith({ data: { organizationId: ORG, fromEntityId: 'salud', toEntityId: 'obras', label: 'Programa conjunto' } });
    await expect(service.link(collab, 'obras', 'salud')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
