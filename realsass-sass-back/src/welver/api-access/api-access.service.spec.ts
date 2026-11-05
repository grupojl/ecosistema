import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiAccessService } from '@/welver/api-access/api-access.service';
import { EntityAccess, type EntityAccessService } from '@/welver/entity-access/entity-access.service';
import type { SubscriptionService } from '@/welver/subscription/subscription.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { WelverActor } from '@/welver/welver.types';
import { generateApiKey } from '@/welver/domain/api-access';

const ORG = 'org-1';
const owner: WelverActor = { organizationId: ORG, uid: 'owner', role: 'OWNER' };
const collab: WelverActor = { organizationId: ORG, uid: 'collab', role: 'COLLABORATOR' };

const profile = (id: string, parentId: string | null, visible: string[] = [], over: Record<string, unknown> = {}) => ({
  id,
  organizationId: ORG,
  parentId,
  name: id,
  visibleEntityIds: visible,
  allowedChannels: [],
  rateLimitPerMinute: null,
  isActive: true,
  ...over,
});

function setup(opts: { flag?: boolean; profiles?: ReturnType<typeof profile>[]; known?: number } = {}) {
  const profiles = opts.profiles ?? [];
  const tenant = {
    apiProfile: {
      findMany: jest.fn().mockResolvedValue(profiles),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(profiles.find((p) => p.id === where.id) ?? null)),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'p-new', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    apiKey: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'k-new', createdAt: new Date(), ...data })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    municipalEntity: { count: jest.fn().mockResolvedValue(opts.known ?? 0) },
  };
  const root = {
    forTenant: jest.fn().mockReturnValue(tenant),
    featureFlag: { findFirst: jest.fn().mockResolvedValue(opts.flag === false ? null : { id: 'f1' }) },
    apiKey: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    apiProfile: { findMany: jest.fn().mockResolvedValue(profiles) },
  };
  const access = {
    forActor: jest.fn().mockImplementation((a: WelverActor) => Promise.resolve(new EntityAccess(a.role === 'OWNER', new Map(), new Map()))),
  };
  const subs = { assertWritable: jest.fn().mockResolvedValue(undefined) };
  const service = new ApiAccessService(root as unknown as PrismaService, access as unknown as EntityAccessService, subs as unknown as SubscriptionService);
  return { service, tenant, root };
}

describe('ApiAccessService — compuertas', () => {
  it('sin el flag welver.api no se crea nada', async () => {
    await expect(setup({ flag: false }).service.createProfile(owner, { name: 'x' })).rejects.toThrow('no está habilitada');
  });

  it('solo el dueño', async () => {
    await expect(setup().service.createProfile(collab, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup().service.listProfiles(collab)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup().service.listKeys(collab)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ApiAccessService — perfiles', () => {
  it('crea un perfil raíz', async () => {
    const { service, tenant } = setup({ known: 2 });
    await service.createProfile(owner, { name: 'Municipio', visibleEntityIds: ['a', 'b'], allowedChannels: ['web'], rateLimitPerMinute: 60 });
    expect(tenant.apiProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Municipio', parentId: null, visibleEntityIds: ['a', 'b'], rateLimitPerMinute: 60, isActive: true }),
    });
  });

  it('los entes visibles deben existir en el municipio', async () => {
    const { service } = setup({ known: 1 });
    await expect(service.createProfile(owner, { name: 'x', visibleEntityIds: ['a', 'fantasma'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el hijo no ve más que el padre', async () => {
    const { service } = setup({ profiles: [profile('raiz', null, ['a', 'b'])], known: 1 });
    await expect(service.createProfile(owner, { name: 'h', parentId: 'raiz', visibleEntityIds: ['c'] })).rejects.toThrow('padre');
    await expect(service.createProfile(owner, { name: 'h', parentId: 'raiz', visibleEntityIds: ['a'] })).resolves.toBeTruthy();
    await expect(service.createProfile(owner, { name: 'h', parentId: 'inexistente' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualizar: detecta ciclos y valida el alcance solo si cambia lo que importa', async () => {
    const profiles = [profile('a', null), profile('b', 'a'), profile('c', 'b')];
    const { service, tenant } = setup({ profiles });
    await expect(service.updateProfile(owner, 'a', { parentId: 'c' })).rejects.toThrow('sí mismo');
    await service.updateProfile(owner, 'c', { name: 'Renombrado', isActive: false });
    expect(tenant.apiProfile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Renombrado', isActive: false } }));
    await expect(service.updateProfile(owner, 'nope', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un perfil con hijos o claves se desactiva; uno vacío se borra', async () => {
    const used = setup({ profiles: [profile('p', null)] });
    used.tenant.apiProfile.count.mockResolvedValue(1);
    expect(await used.service.removeProfile(owner, 'p')).toEqual({ removed: false, deactivated: true });
    expect(used.tenant.apiProfile.update).toHaveBeenCalledWith({ where: { id: 'p' }, data: { isActive: false } });
    const empty = setup({ profiles: [profile('p', null)] });
    expect(await empty.service.removeProfile(owner, 'p')).toEqual({ removed: true, deactivated: false });
    await expect(empty.service.removeProfile(owner, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ApiAccessService — claves', () => {
  it('devuelve la clave en claro una vez y guarda solo el hash', async () => {
    const { service, tenant } = setup({ profiles: [profile('p', null)] });
    const created = await service.createKey(owner, 'p', 'Turnos');
    expect(created.key.startsWith('wlv_')).toBe(true);
    const saved = tenant.apiKey.create.mock.calls[0]?.[0] as { data: { keyHash: string; prefix: string } };
    expect(saved.data.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(saved)).not.toContain(created.key);
    expect(created.prefix).toBe(created.key.slice(0, 12));
  });

  it('no emite claves para un perfil inexistente o desactivado', async () => {
    const { service } = setup({ profiles: [profile('off', null, [], { isActive: false })] });
    await expect(service.createKey(owner, 'nope', 'x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createKey(owner, 'off', 'x')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revocar: una clave ya revocada es NotFound', async () => {
    const { service, tenant } = setup();
    expect(await service.revokeKey(owner, 'k1')).toEqual({ revoked: true });
    tenant.apiKey.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revokeKey(owner, 'k1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rotar: revoca la vieja y emite otra con el mismo perfil y nombre', async () => {
    const { service, tenant } = setup({ profiles: [profile('p', null)] });
    tenant.apiKey.findFirst.mockResolvedValue({ profileId: 'p', name: 'Turnos' });
    const rotated = await service.rotateKey(owner, 'k1');
    expect(tenant.apiKey.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { revokedAt: expect.any(Date) } });
    expect(rotated).toMatchObject({ profileId: 'p', name: 'Turnos' });
    tenant.apiKey.findFirst.mockResolvedValue(null);
    await expect(service.rotateKey(owner, 'k1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el listado nunca incluye el hash ni la clave', async () => {
    const { service, tenant } = setup();
    await service.listKeys(owner, 'p');
    const arg = tenant.apiKey.findMany.mock.calls[0]?.[0] as { select: Record<string, boolean> };
    expect(arg.select).not.toHaveProperty('keyHash');
  });
});

describe('ApiAccessService.verifyKey', () => {
  const key = generateApiKey();
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'k1',
    organizationId: ORG,
    profileId: 'hijo',
    revokedAt: null,
    lastUsedAt: null,
    profile: profile('hijo', 'raiz', ['a'], { allowedChannels: ['web'], rateLimitPerMinute: 30 }),
    ...over,
  });
  const profiles = [profile('raiz', null, ['a', 'b']), profile('hijo', 'raiz', ['a'], { allowedChannels: ['web'], rateLimitPerMinute: 30 })];

  it('devuelve el alcance efectivo del perfil (hereda y restringe)', async () => {
    const { service, root } = setup({ profiles });
    root.apiKey.findUnique.mockResolvedValue(row());
    expect(await service.verifyKey(key.plain)).toEqual({
      organizationId: ORG,
      profileId: 'hijo',
      keyId: 'k1',
      visibleEntityIds: ['a'],
      allowedChannels: ['web'],
      rateLimitPerMinute: 30,
    });
    expect(root.apiKey.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { keyHash: key.hash } }));
  });

  it('null si la forma es inválida, no existe, está revocada, el perfil está inactivo o el flag está apagado', async () => {
    const a = setup({ profiles });
    expect(await a.service.verifyKey('basura')).toBeNull();
    expect(a.root.apiKey.findUnique).not.toHaveBeenCalled(); // ni siquiera va a la base

    a.root.apiKey.findUnique.mockResolvedValue(null);
    expect(await a.service.verifyKey(key.plain)).toBeNull();
    a.root.apiKey.findUnique.mockResolvedValue(row({ revokedAt: new Date() }));
    expect(await a.service.verifyKey(key.plain)).toBeNull();
    a.root.apiKey.findUnique.mockResolvedValue(row({ profile: profile('hijo', null, [], { isActive: false }) }));
    expect(await a.service.verifyKey(key.plain)).toBeNull();

    const off = setup({ profiles, flag: false });
    off.root.apiKey.findUnique.mockResolvedValue(row());
    expect(await off.service.verifyKey(key.plain)).toBeNull();
  });

  it('registra el último uso, pero no en cada request (como mucho una vez por minuto)', async () => {
    const now = new Date('2026-11-05T12:00:00Z');
    const a = setup({ profiles });
    a.root.apiKey.findUnique.mockResolvedValue(row({ lastUsedAt: new Date('2026-11-05T11:59:30Z') }));
    await a.service.verifyKey(key.plain, now);
    expect(a.root.apiKey.update).not.toHaveBeenCalled();
    a.root.apiKey.findUnique.mockResolvedValue(row({ lastUsedAt: new Date('2026-11-05T11:00:00Z') }));
    await a.service.verifyKey(key.plain, now);
    expect(a.root.apiKey.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { lastUsedAt: now } });
  });
});
