import { NotFoundException } from '@nestjs/common';
import { MunicipalityService } from '@/welver/municipality/municipality.service';
import { EntityAccessService, EntityPermissionsService, EntityAccess } from '@/welver/entity-access/entity-access.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { WelverActor } from '@/welver/welver.types';

const ORG = 'org-1';

describe('MunicipalityService', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: ORG,
    name: 'Municipio',
    countryCode: 'AR',
    dataRegion: 'ar',
    population: 18_000,
    orgChartTemplate: null,
    dataRetentionDays: 90,
    ...over,
  });

  function setup(initial = row()) {
    const org = {
      findUnique: jest.fn().mockResolvedValue(initial),
      update: jest.fn().mockResolvedValue({}),
    };
    const audit = { log: jest.fn() };
    const service = new MunicipalityService({ organization: org } as unknown as PrismaService, audit as unknown as ConfigAuditService);
    return { service, org, audit };
  }

  it('deriva el tramo y la plantilla sugerida de la población', async () => {
    expect(await setup().service.get(ORG)).toMatchObject({ population: 18_000, tier: 1, suggestedTemplate: 'small', dataRetentionDays: 90, dataRegion: 'ar' });
    expect(await setup(row({ population: 350_000 })).service.get(ORG)).toMatchObject({ tier: 3, suggestedTemplate: 'large' });
  });

  it('sin población no hay tramo ni plantilla sugerida; una plantilla guardada inválida se ignora', async () => {
    const view = await setup(row({ population: null, orgChartTemplate: 'borrada' })).service.get(ORG);
    expect(view).toMatchObject({ tier: null, suggestedTemplate: null, orgChartTemplate: null });
    expect((await setup(row({ orgChartTemplate: 'medium' })).service.get(ORG)).orgChartTemplate).toBe('medium');
  });

  it('un municipio inexistente es NotFound', async () => {
    const { service, org } = setup();
    org.findUnique.mockResolvedValue(null);
    await expect(service.get(ORG)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualiza solo lo recibido y audita el antes y el después', async () => {
    const { service, org, audit } = setup();
    org.findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ population: 120_000, dataRetentionDays: 30 }));
    const after = await service.update(ORG, 'u1', { population: 120_000, dataRetentionDays: 30 });
    expect(org.update).toHaveBeenCalledWith({ where: { id: ORG }, data: { population: 120_000, dataRetentionDays: 30 } });
    expect(after.tier).toBe(3);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ configType: 'municipality', diff: expect.objectContaining({ population: [18_000, 120_000], dataRetentionDays: [90, 30] }) }),
    );
  });
});

describe('EntityAccessService / EntityPermissionsService', () => {
  const owner: WelverActor = { organizationId: ORG, uid: 'owner', role: 'OWNER' };
  const collab: WelverActor = { organizationId: ORG, uid: 'collab', role: 'COLLABORATOR' };

  function setup() {
    const tenant = {
      municipalEntity: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'salud', parentId: null },
          { id: 'hospital', parentId: 'salud' },
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: 'salud' }),
      },
      collaborator: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', status: 'ACTIVE' }) },
      entityPermission: {
        findMany: jest.fn().mockResolvedValue([{ collaboratorId: 'c1', entityId: 'salud', canView: true, canEdit: true, canApprove: false, canPublish: false }]),
        upsert: jest.fn().mockImplementation((args) => Promise.resolve(args)),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = { forTenant: jest.fn().mockReturnValue(tenant) } as unknown as PrismaService;
    return { access: new EntityAccessService(prisma), permissions: new EntityPermissionsService(prisma), tenant };
  }

  it('el dueño pasa siempre y no consulta permisos', async () => {
    const { access, tenant } = setup();
    const a = await access.forActor(owner);
    expect(a.isOwner).toBe(true);
    expect(a.can('hospital', 'publish')).toBe(true);
    expect(tenant.collaborator.findFirst).not.toHaveBeenCalled();
  });

  it('un colaborador activo hereda el permiso del ente al subárbol', async () => {
    const { access } = setup();
    const a = await access.forActor(collab);
    expect(a.can('hospital', 'edit')).toBe(true);
    expect(a.can('hospital', 'publish')).toBe(false);
    expect(a.idsAllowing('view')).toEqual(new Set(['salud', 'hospital']));
    expect(a.permissionsFor('salud')).toEqual({ view: true, edit: true, approve: false, publish: false });
  });

  it('un usuario que no es colaborador activo no tiene acceso a nada', async () => {
    const { access, tenant } = setup();
    tenant.collaborator.findFirst.mockResolvedValue(null);
    const a = await access.forActor(collab);
    expect(a.idsAllowing('view')?.size).toBe(0);
    expect(tenant.entityPermission.findMany).not.toHaveBeenCalled();
  });

  it('EntityAccess: un ente inexistente es NotFound; sin permiso, Forbidden; el dueño pasa', () => {
    const a = new EntityAccess(false, new Map([['x', { id: 'x', parentId: null }]]), new Map());
    expect(() => a.assert('nope', 'view')).toThrow('no encontrado');
    expect(() => a.assert('x', 'edit')).toThrow('No tenés permiso para editar');
    expect(() => a.assertOwner()).toThrow('administrador');
    expect(new EntityAccess(true, new Map(), new Map()).idsAllowing('view')).toBeNull();
    expect(() => new EntityAccess(true, new Map(), new Map()).assertOwner()).not.toThrow();
  });

  it('set: valida colaborador y ente, y hace upsert solo con lo recibido', async () => {
    const { permissions, tenant } = setup();
    tenant.collaborator.findFirst.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
    await permissions.set(ORG, 'c1', 'salud', { canEdit: true });
    expect(tenant.entityPermission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { collaboratorId_entityId: { collaboratorId: 'c1', entityId: 'salud' } },
        update: { canEdit: true },
        create: expect.objectContaining({ organizationId: ORG, collaboratorId: 'c1', entityId: 'salud', canEdit: true }),
      }),
    );
    tenant.collaborator.findFirst.mockResolvedValue({ id: 'c1', status: 'REMOVED' });
    await expect(permissions.set(ORG, 'c1', 'salud', {})).rejects.toBeInstanceOf(NotFoundException);
    tenant.collaborator.findFirst.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
    tenant.municipalEntity.findFirst.mockResolvedValue(null);
    await expect(permissions.set(ORG, 'c1', 'fantasma', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('list y remove', async () => {
    const { permissions, tenant } = setup();
    await permissions.list(ORG, 'c1');
    expect(tenant.entityPermission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { collaboratorId: 'c1' } }));
    expect(await permissions.remove(ORG, 'c1', 'salud')).toEqual({ removed: true });
    tenant.entityPermission.deleteMany.mockResolvedValue({ count: 0 });
    expect(await permissions.remove(ORG, 'c1', 'salud')).toEqual({ removed: false });
  });
});
