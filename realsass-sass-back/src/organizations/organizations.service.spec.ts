import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuotaExceededException } from '@/common/exceptions/quota-exceeded.exception';
import { OrganizationsService } from './organizations.service';

const make = () => {
  const repo = {
    create: jest.fn(async (data: { slug: string }) => ({ id: 'org-new', slug: data.slug })),
    slugExists: jest.fn().mockResolvedValue(false),
    listByFirebaseUid: jest.fn(),
    resolveUserId: jest.fn(),
    countByUserId: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    findBySlug: jest.fn(),
    findPublicById: jest.fn(),
    listPublicStores: jest.fn(),
  };
  const markets = { seedDefaultMarket: jest.fn() };
  return { svc: new OrganizationsService(repo as never, markets as never), repo, markets };
};

describe('OrganizationsService', () => {
  afterEach(() => delete process.env['MAX_ORGS_PER_USER']);

  describe('createForUser / slug', () => {
    it('genera un slug legible sin acentos y con sufijo aleatorio', async () => {
      const { svc, repo } = make();
      await svc.createForUser('u1', undefined, 'Ñandú & Café!', 'AR');
      const arg = repo.create.mock.calls[0]![0];
      expect(arg.slug).toMatch(/^nandu-cafe-[0-9a-f]{4}$/);
      expect(arg).toMatchObject({ userId: 'u1', name: 'Ñandú & Café!', countryCode: 'AR' });
    });

    it('sin nombre usa "tienda" y no manda name/countryCode', async () => {
      const { svc, repo } = make();
      await svc.createForUser('u1');
      const arg = repo.create.mock.calls[0]![0];
      expect(arg.slug).toMatch(/^tienda-[0-9a-f]{4}$/);
      expect(arg).not.toHaveProperty('name');
      expect(arg).not.toHaveProperty('countryCode');
    });

    it('reintenta si el slug existe y cae a un sufijo más largo tras 5 colisiones', async () => {
      const { svc, repo } = make();
      repo.slugExists.mockResolvedValue(true);
      await svc.createForUser('u1', undefined, 'Mi Tienda');
      expect(repo.slugExists).toHaveBeenCalledTimes(5);
      expect(repo.create.mock.calls[0]![0].slug).toMatch(/^mi-tienda-[0-9a-f]{8}$/);
    });
  });

  describe('createMine (tope de organizaciones)', () => {
    it('404 si el usuario no existe', async () => {
      const { svc, repo } = make();
      repo.resolveUserId.mockResolvedValue(null);
      await expect(svc.createMine('uid', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza al llegar al tope (3 por defecto)', async () => {
      const { svc, repo } = make();
      repo.resolveUserId.mockResolvedValue('u1');
      repo.countByUserId.mockResolvedValue(3);
      await expect(svc.createMine('uid', { name: 'x' })).rejects.toBeInstanceOf(QuotaExceededException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('respeta MAX_ORGS_PER_USER y cae a 3 si el valor es inválido', async () => {
      const { svc, repo } = make();
      repo.resolveUserId.mockResolvedValue('u1');
      process.env['MAX_ORGS_PER_USER'] = '1';
      repo.countByUserId.mockResolvedValue(1);
      await expect(svc.createMine('uid', { name: 'x' })).rejects.toBeInstanceOf(QuotaExceededException);
      process.env['MAX_ORGS_PER_USER'] = 'abc';
      repo.countByUserId.mockResolvedValue(2);
      await expect(svc.createMine('uid', { name: 'x' })).resolves.toBeDefined();
    });

    it('crea la organización y siembra su Market default con el país indicado', async () => {
      const { svc, repo, markets } = make();
      repo.resolveUserId.mockResolvedValue('u1');
      repo.countByUserId.mockResolvedValue(0);
      await svc.createMine('uid', { name: 'Tienda', countryCode: 'BR' });
      expect(markets.seedDefaultMarket).toHaveBeenCalledWith('org-new', 'BR');
    });
  });

  describe('ensureDefaultOrganization', () => {
    it('devuelve la existente sin crear nada', async () => {
      const { svc, repo } = make();
      repo.findByUserId.mockResolvedValue({ id: 'org-1' });
      expect(await svc.ensureDefaultOrganization({ id: 'u1' })).toEqual({ organization: { id: 'org-1' }, created: false });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it.each([
      [{ id: 'u', displayName: 'Ana', email: 'a@b.com' }, 'Tienda de Ana'],
      [{ id: 'u', displayName: null, email: 'bob@b.com' }, 'Tienda de bob'],
      [{ id: 'u', displayName: ' ', email: null }, 'Mi tienda'],
    ])('crea con nombre derivado (%#)', async (user, expected) => {
      const { svc, repo, markets } = make();
      repo.findByUserId.mockResolvedValue(null);
      const out = await svc.ensureDefaultOrganization(user);
      expect(out.created).toBe(true);
      expect(repo.create.mock.calls[0]![0].name).toBe(expected);
      expect(markets.seedDefaultMarket).toHaveBeenCalledWith('org-new', 'AR');
    });
  });

  describe('organización activa y propiedad', () => {
    const orgs = [{ id: 'a' }, { id: 'b' }];

    it('getMyOrganization usa la activa si es propia, si no la más antigua', async () => {
      const { svc, repo } = make();
      repo.listByFirebaseUid.mockResolvedValue(orgs);
      expect(await svc.getMyOrganization('uid', 'b')).toEqual({ id: 'b' });
      expect(await svc.getMyOrganization('uid', 'ajena')).toEqual({ id: 'a' });
      expect(await svc.getMyOrganization('uid')).toEqual({ id: 'a' });
    });

    it('getMyOrganization: 404 si no tiene ninguna', async () => {
      const { svc, repo } = make();
      repo.listByFirebaseUid.mockResolvedValue([]);
      await expect(svc.getMyOrganization('uid')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateMyOrganization actualiza SOLO la organización propia resuelta', async () => {
      const { svc, repo } = make();
      repo.listByFirebaseUid.mockResolvedValue(orgs);
      repo.update.mockResolvedValue({ id: 'b', name: 'n' });
      await svc.updateMyOrganization('uid', { name: 'n' } as never, 'b');
      expect(repo.update).toHaveBeenCalledWith('b', { name: 'n' });
    });

    it('getOrganizationWithOwner: 404 sin orgs, 403 si la org es de otro, ok si es propia', async () => {
      const { svc, repo } = make();
      repo.listByFirebaseUid.mockResolvedValueOnce([]);
      await expect(svc.getOrganizationWithOwner('a', 'uid')).rejects.toBeInstanceOf(NotFoundException);
      repo.listByFirebaseUid.mockResolvedValue(orgs);
      await expect(svc.getOrganizationWithOwner('zzz', 'uid')).rejects.toBeInstanceOf(ForbiddenException);
      expect(await svc.getOrganizationWithOwner('a', 'uid')).toEqual({ id: 'a' });
    });
  });

  describe('lecturas públicas', () => {
    it('listPublicStores acota el límite a [1, 5000]', async () => {
      const { svc, repo } = make();
      await svc.listPublicStores(999999);
      await svc.listPublicStores(-5);
      await svc.listPublicStores();
      expect(repo.listPublicStores.mock.calls.map((c) => c[0])).toEqual([5000, 1, 5000]);
    });

    it('delegan en el repositorio', async () => {
      const { svc, repo } = make();
      repo.findBySlug.mockResolvedValue({ slug: 's' });
      repo.findPublicById.mockResolvedValue({ id: 'i' });
      repo.findByUserId.mockResolvedValue({ id: 'o' });
      repo.listByFirebaseUid.mockResolvedValue([1]);
      expect(await svc.findBySlugPublic('s')).toEqual({ slug: 's' });
      expect(await svc.findByIdPublic('i')).toEqual({ id: 'i' });
      expect(await svc.findByUserId('u')).toEqual({ id: 'o' });
      expect(await svc.listMine('uid')).toEqual([1]);
    });
  });
});
