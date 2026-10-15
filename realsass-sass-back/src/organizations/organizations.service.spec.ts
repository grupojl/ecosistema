import { QuotaExceededException } from '@/common/exceptions/quota-exceeded.exception';
import type { MarketsService } from '@/markets/markets.service';
import { currentTenantScope, type TenantScope } from '@/prisma/tenant-context';
import { OrganizationsService } from '@/organizations/organizations.service';
import type { IOrganizationsRepository } from '@/organizations/repository/organizations.repository.interface';

const org = (id: string, over: Record<string, unknown> = {}) => ({ id, name: `Org ${id}`, slug: `org-${id}`, ...over });

describe('OrganizationsService', () => {
  const repo = {
    create: jest.fn(), slugExists: jest.fn(), listByFirebaseUid: jest.fn(), resolveUserId: jest.fn(),
    countByUserId: jest.fn(), findByUserId: jest.fn(), update: jest.fn(), findBySlug: jest.fn(),
  };
  const markets = { seedDefaultMarket: jest.fn() };
  const service = new OrganizationsService(repo as unknown as IOrganizationsRepository, markets as unknown as MarketsService);
  let savedMax: string | undefined;

  beforeEach(() => {
    jest.resetAllMocks();
    savedMax = process.env['MAX_ORGS_PER_USER'];
    repo.slugExists.mockResolvedValue(false);
    repo.create.mockImplementation((data: { slug: string }) => Promise.resolve(org('00000000-0000-4000-8000-0000000000aa', { slug: data.slug })));
  });
  afterEach(() => { if (savedMax === undefined) delete process.env['MAX_ORGS_PER_USER']; else process.env['MAX_ORGS_PER_USER'] = savedMax; });

  describe('slug', () => {
    it('es legible, sin tildes ni símbolos, y lleva un sufijo aleatorio (no derivable del usuario)', async () => {
      await service.createForUser('u-1', undefined, 'Café ñandú & Co.!');

      const { slug } = repo.create.mock.calls[0]![0] as { slug: string };
      expect(slug).toMatch(/^cafe-nandu-co-[0-9a-f]{4}$/);
    });

    it('sin nombre usa "tienda"; con un nombre solo de símbolos también', async () => {
      await service.createForUser('u-1');
      await service.createForUser('u-1', undefined, '¡¡¡???');
      for (const [data] of repo.create.mock.calls as Array<[{ slug: string }]>) expect(data.slug).toMatch(/^tienda-[0-9a-f]{4}$/);
    });

    it('reintenta si el slug ya existe y termina con un sufijo más largo si todo colisiona', async () => {
      repo.slugExists.mockResolvedValue(true);
      await service.createForUser('u-1', undefined, 'Mi tienda');
      expect(repo.slugExists).toHaveBeenCalledTimes(5);
      expect((repo.create.mock.calls[0]![0] as { slug: string }).slug).toMatch(/^mi-tienda-[0-9a-f]{8}$/);
    });
  });

  describe('createMine (D3: tope de organizaciones por usuario)', () => {
    it('usuario inexistente => NotFound', async () => {
      repo.resolveUserId.mockResolvedValue(null);
      await expect(service.createMine('uid', { name: 'X' })).rejects.toMatchObject({ status: 404 });
    });

    it('al llegar al tope lanza QuotaExceeded y NO crea nada', async () => {
      process.env['MAX_ORGS_PER_USER'] = '2';
      repo.resolveUserId.mockResolvedValue('u-1');
      repo.countByUserId.mockResolvedValue(2);

      await expect(service.createMine('uid', { name: 'X' })).rejects.toBeInstanceOf(QuotaExceededException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('por debajo del tope crea la organización y siembra su Market default (ADR-014)', async () => {
      repo.resolveUserId.mockResolvedValue('u-1');
      repo.countByUserId.mockResolvedValue(0);

      const created = await service.createMine('uid', { name: 'Mi tienda', countryCode: 'BR' });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-1', name: 'Mi tienda', countryCode: 'BR' }), undefined);
      expect(markets.seedDefaultMarket).toHaveBeenCalledWith(created.id, 'BR');
    });

    it('ADR-027: el Market default se siembra dentro del alcance de la organización NUEVA', async () => {
      repo.resolveUserId.mockResolvedValue('u-1');
      repo.countByUserId.mockResolvedValue(0);
      let scope: TenantScope | null = null;
      markets.seedDefaultMarket.mockImplementation(() => { scope = currentTenantScope(); return Promise.resolve({}); });

      const created = await service.createMine('uid', { name: 'Mi tienda', countryCode: 'BR' });

      expect(scope).toEqual({ kind: 'tenant', organizationId: created.id });
    });

    it('un MAX_ORGS_PER_USER inválido cae al default 3', async () => {
      process.env['MAX_ORGS_PER_USER'] = 'abc';
      repo.resolveUserId.mockResolvedValue('u-1');
      repo.countByUserId.mockResolvedValue(3);
      await expect(service.createMine('uid', { name: 'X' })).rejects.toBeInstanceOf(QuotaExceededException);
    });
  });

  describe('ensureDefaultOrganization (D1)', () => {
    it('si ya tiene una, la devuelve sin crear otra', async () => {
      repo.findByUserId.mockResolvedValue(org('existente'));
      await expect(service.ensureDefaultOrganization({ id: 'u-1' })).resolves.toMatchObject({ created: false, organization: { id: 'existente' } });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('si no tiene, crea "Tienda de <nombre>" (o del email, o "Mi tienda")', async () => {
      repo.findByUserId.mockResolvedValue(null);
      repo.resolveUserId.mockResolvedValue('u-1');

      await service.ensureDefaultOrganization({ id: 'u-1', displayName: 'Ana' });
      await service.ensureDefaultOrganization({ id: 'u-1', displayName: null, email: 'beto@ejemplo.com' });
      await service.ensureDefaultOrganization({ id: 'u-1' });

      const names = (repo.create.mock.calls as Array<[{ name: string }]>).map(([d]) => d.name);
      expect(names).toEqual(['Tienda de Ana', 'Tienda de beto', 'Mi tienda']);
    });
  });

  describe('multi-tenant: solo se opera lo propio', () => {
    it('getMyOrganization prefiere la activa SI es del usuario; si no, la más antigua; sin ninguna, NotFound', async () => {
      repo.listByFirebaseUid.mockResolvedValue([org('a'), org('b')]);
      expect((await service.getMyOrganization('uid', 'b')).id).toBe('b');
      expect((await service.getMyOrganization('uid', 'ajena')).id).toBe('a'); // una org ajena NO se puede activar
      expect((await service.getMyOrganization('uid')).id).toBe('a');

      repo.listByFirebaseUid.mockResolvedValue([]);
      await expect(service.getMyOrganization('uid')).rejects.toMatchObject({ status: 404 });
    });

    it('updateMyOrganization actualiza SOLO la organización resuelta del usuario, no un id del cliente', async () => {
      repo.listByFirebaseUid.mockResolvedValue([org('a')]);
      await service.updateMyOrganization('uid', { name: 'Nuevo' }, 'ajena');
      expect(repo.update).toHaveBeenCalledWith('a', { name: 'Nuevo' });
    });

    it('getOrganizationWithOwner: ajena => Forbidden; sin organizaciones => NotFound; propia => ok', async () => {
      repo.listByFirebaseUid.mockResolvedValue([org('a')]);
      await expect(service.getOrganizationWithOwner('b', 'uid')).rejects.toMatchObject({ status: 403 });
      await expect(service.getOrganizationWithOwner('a', 'uid')).resolves.toMatchObject({ id: 'a' });

      repo.listByFirebaseUid.mockResolvedValue([]);
      await expect(service.getOrganizationWithOwner('a', 'uid')).rejects.toMatchObject({ status: 404 });
    });
  });

  it('findBySlugPublic y findByUserId delegan en el repositorio', async () => {
    repo.findBySlug.mockResolvedValue({ slug: 's' });
    await expect(service.findBySlugPublic('s')).resolves.toEqual({ slug: 's' });
    await service.findByUserId('u-1');
    expect(repo.findByUserId).toHaveBeenCalledWith('u-1');
  });
});
