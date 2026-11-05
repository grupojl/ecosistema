import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChannelsService } from '@/welver/channels/channels.service';
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
const view = (entityId: string): [string, EntityGrant] => [entityId, { entityId, canView: true, canEdit: false, canApprove: false, canPublish: false }];

function setup(opts: { writable?: boolean; grants?: [string, EntityGrant][] } = {}) {
  const tenant = {
    entityChannel: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    municipalEntity: { findFirst: jest.fn().mockResolvedValue({ archivedAt: null }) },
  };
  const prisma = { forTenant: jest.fn().mockReturnValue(tenant) };
  const access = {
    forActor: jest.fn().mockImplementation((a: WelverActor) => Promise.resolve(new EntityAccess(a.role === 'OWNER', nodes, new Map(opts.grants ?? [])))),
  };
  const subs = { assertWritable: opts.writable === false ? jest.fn().mockRejectedValue(new ForbiddenException('solo lectura')) : jest.fn().mockResolvedValue(undefined) };
  const service = new ChannelsService(prisma as unknown as PrismaService, access as unknown as EntityAccessService, subs as unknown as SubscriptionService);
  return { service, tenant };
}

const input = { entityId: 'salud', provider: 'WHATSAPP' as const, accountRef: '549111' };

describe('ChannelsService.register', () => {
  it('solo el dueño conecta', async () => {
    await expect(setup().service.register(collab, input)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('crea el canal en PENDING', async () => {
    const { service, tenant } = setup();
    await service.register(owner, { ...input, displayName: 'Salud' });
    expect(tenant.entityChannel.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entityId: 'salud', provider: 'WHATSAPP', displayName: 'Salud' }) }));
  });

  it('una cuenta por ente y red, y una cuenta no se comparte entre entes', async () => {
    const a = setup();
    a.tenant.entityChannel.findFirst.mockResolvedValueOnce({ id: 'otro' }).mockResolvedValueOnce(null);
    await expect(a.service.register(owner, input)).rejects.toThrow('una por ente');
    const b = setup();
    b.tenant.entityChannel.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ entityId: 'obras' });
    await expect(b.service.register(owner, input)).rejects.toThrow('otro ente');
  });

  it('el ente debe existir y no estar archivado', async () => {
    const missing = setup();
    missing.tenant.municipalEntity.findFirst.mockResolvedValue(null);
    await expect(missing.service.register(owner, input)).rejects.toBeInstanceOf(NotFoundException);
    const archived = setup();
    archived.tenant.municipalEntity.findFirst.mockResolvedValue({ archivedAt: new Date() });
    await expect(archived.service.register(owner, input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('con el paquete suspendido es solo lectura', async () => {
    await expect(setup({ writable: false }).service.register(owner, input)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ChannelsService — estado', () => {
  const channel = (over: Record<string, unknown> = {}) => ({ id: 'c1', status: 'CONNECTED', connectedAt: new Date(), pausedReason: null, ...over });

  it('pausa a mano con motivo MANUAL; pausar uno ya pausado no hace nada', async () => {
    const a = setup();
    a.tenant.entityChannel.findFirst.mockResolvedValue(channel());
    await a.service.pause(owner, 'c1');
    expect(a.tenant.entityChannel.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PAUSED', pausedReason: 'MANUAL' }) }));
    const b = setup();
    b.tenant.entityChannel.findFirst.mockResolvedValue(channel({ status: 'PAUSED' }));
    await b.service.pause(owner, 'c1');
    expect(b.tenant.entityChannel.update).not.toHaveBeenCalled();
  });

  it('reanuda a CONNECTED si ya estuvo conectado, a PENDING si nunca', async () => {
    const a = setup();
    a.tenant.entityChannel.findFirst.mockResolvedValue(channel({ status: 'PAUSED', pausedReason: 'MANUAL' }));
    await a.service.resume(owner, 'c1');
    expect(a.tenant.entityChannel.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CONNECTED', pausedReason: null }) }));
    const b = setup();
    b.tenant.entityChannel.findFirst.mockResolvedValue(channel({ status: 'PAUSED', pausedReason: 'MANUAL', connectedAt: null }));
    await b.service.resume(owner, 'c1');
    expect(b.tenant.entityChannel.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }));
  });

  it('un canal pausado por la suscripción no se reanuda a mano', async () => {
    const { service, tenant } = setup();
    tenant.entityChannel.findFirst.mockResolvedValue(channel({ status: 'PAUSED', pausedReason: 'SUBSCRIPTION' }));
    await expect(service.resume(owner, 'c1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('no hace nada al reanudar uno que no está pausado', async () => {
    const { service, tenant } = setup();
    tenant.entityChannel.findFirst.mockResolvedValue(channel());
    await service.resume(owner, 'c1');
    expect(tenant.entityChannel.update).not.toHaveBeenCalled();
  });

  it('quitar: solo el dueño, y el canal debe existir', async () => {
    const { service, tenant } = setup();
    await expect(service.remove(owner, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    tenant.entityChannel.findFirst.mockResolvedValue(channel());
    expect(await service.remove(owner, 'c1')).toEqual({ removed: true });
    await expect(setup().service.remove(collab, 'c1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('markStatus (integración): CONNECTED marca la fecha; ERROR guarda el detalle y limpia al conectar', async () => {
    const { service, tenant } = setup();
    tenant.entityChannel.findFirst.mockResolvedValue(channel({ status: 'PENDING' }));
    await service.markStatus(ORG, 'c1', 'CONNECTED', { secretKey: 'meta:c1' });
    expect(tenant.entityChannel.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONNECTED', lastError: null, secretKey: 'meta:c1', connectedAt: expect.any(Date) }) }),
    );
    await service.markStatus(ORG, 'c1', 'ERROR', { error: 'token vencido' });
    expect(tenant.entityChannel.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ERROR', lastError: 'token vencido' }) }));
  });
});

describe('ChannelsService.list', () => {
  it('un colaborador ve solo los canales de los entes que puede ver', async () => {
    const { service, tenant } = setup({ grants: [view('salud')] });
    await service.list(collab);
    expect(tenant.entityChannel.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { entityId: { in: ['salud'] } } }));
  });

  it('el dueño ve todos y nunca se pide el secreto', async () => {
    const { service, tenant } = setup();
    await service.list(owner);
    const arg = tenant.entityChannel.findMany.mock.calls[0]?.[0] as { where: object; select: Record<string, boolean> };
    expect(arg.where).toEqual({});
    expect(arg.select).not.toHaveProperty('secretKey');
  });
});
