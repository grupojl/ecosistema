import { InternalOrganizationsService } from '@/internal/internal-organizations.service';
import type { IInternalOrganizationsRepository, InternalOrgRow } from '@/internal/repository/internal-organizations.repository.interface';

const row = (over: Partial<InternalOrgRow> = {}): InternalOrgRow => ({
  id: 'org-1', ecosystemId: 'eco-1', name: 'Tienda', slug: 'tienda', status: 'ACTIVE', storeStatus: 'ACTIVE',
  plan: 'pro', createdAt: new Date('2026-01-01T00:00:00Z'), suspendedAt: null, ...over,
});

describe('InternalOrganizationsService (superadmin, cross-tenant)', () => {
  const repo = { list: jest.fn(), findById: jest.fn(), suspend: jest.fn(), unsuspend: jest.fn(), setStoreStatus: jest.fn() };
  const service = new InternalOrganizationsService(repo as unknown as IInternalOrganizationsRepository);
  beforeEach(() => { jest.resetAllMocks(); repo.findById.mockResolvedValue(row()); });

  describe('listado y detalle', () => {
    it('pasa filtros y paginación al repositorio y arma la página', async () => {
      repo.list.mockResolvedValue({ rows: [row()], total: 41 });

      const out = await service.findAll({ ecosystemId: 'eco-1', status: 'ACTIVE', storeStatus: undefined, search: 'tie', page: 2, limit: 20 } as never);

      expect(repo.list).toHaveBeenCalledWith({ ecosystemId: 'eco-1', status: 'ACTIVE', storeStatus: undefined, search: 'tie' }, 2, 20);
      expect(out).toMatchObject({ total: 41, page: 2, limit: 20 });
      expect(out.data).toHaveLength(1);
    });

    it('mapea la fila: fechas ISO, defaults (ecosistema "welver", plan "free") y sin suspendedAt si no está suspendida', async () => {
      repo.findById.mockResolvedValue(row({ ecosystemId: null, plan: null }));
      const item = await service.findById('org-1');
      expect(item).toMatchObject({ ecosystemId: 'welver', plan: 'free', createdAt: '2026-01-01T00:00:00.000Z' });
      expect(item.suspendedAt).toBeUndefined();

      repo.findById.mockResolvedValue(row({ status: 'SUSPENDED', suspendedAt: new Date('2026-02-02T00:00:00Z') }));
      expect((await service.findById('org-1')).suspendedAt).toBe('2026-02-02T00:00:00.000Z');
    });

    it('organización inexistente => NotFound', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('x')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('suspend (estado del panel)', () => {
    it('suspende una organización activa, con fecha', async () => {
      repo.suspend.mockResolvedValue(row({ status: 'SUSPENDED', suspendedAt: new Date() }));
      const item = await service.suspend('org-1', 'mora');
      expect(repo.suspend).toHaveBeenCalledWith('org-1', expect.any(Date));
      expect(item.status).toBe('SUSPENDED');
    });

    it('no se suspende dos veces (409) ni una bloqueada (409), y no escribe nada', async () => {
      repo.findById.mockResolvedValueOnce(row({ status: 'SUSPENDED' }));
      await expect(service.suspend('org-1', 'x')).rejects.toMatchObject({ status: 409 });
      repo.findById.mockResolvedValueOnce(row({ status: 'BLOCKED' }));
      await expect(service.suspend('org-1', 'x')).rejects.toMatchObject({ status: 409 });
      expect(repo.suspend).not.toHaveBeenCalled();
    });

    it('organización inexistente => NotFound', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.suspend('x', 'r')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('unsuspend', () => {
    it('reactiva una suspendida', async () => {
      repo.findById.mockResolvedValue(row({ status: 'SUSPENDED' }));
      repo.unsuspend.mockResolvedValue(row());
      expect((await service.unsuspend('org-1', 'pagó')).status).toBe('ACTIVE');
    });

    it('solo reactiva SUSPENDIDAS: una bloqueada o activa => 409 (un bloqueo no se levanta por esta vía)', async () => {
      for (const status of ['ACTIVE', 'BLOCKED']) {
        repo.findById.mockResolvedValueOnce(row({ status }));
        await expect(service.unsuspend('org-1', 'x')).rejects.toMatchObject({ status: 409 });
      }
      expect(repo.unsuspend).not.toHaveBeenCalled();
    });
  });

  describe('storeStatus (storefront público, independiente del panel)', () => {
    it('pausa y reanuda la tienda', async () => {
      repo.setStoreStatus.mockResolvedValueOnce(row({ storeStatus: 'PAUSED' }));
      expect((await service.pauseStore('org-1', 'r')).storeStatus).toBe('PAUSED');
      expect(repo.setStoreStatus).toHaveBeenLastCalledWith('org-1', 'PAUSED');

      repo.findById.mockResolvedValue(row({ storeStatus: 'PAUSED' }));
      repo.setStoreStatus.mockResolvedValueOnce(row());
      expect((await service.resumeStore('org-1', 'r')).storeStatus).toBe('ACTIVE');
      expect(repo.setStoreStatus).toHaveBeenLastCalledWith('org-1', 'ACTIVE');
    });

    it('pausar una pausada / reanudar una activa => 409', async () => {
      repo.findById.mockResolvedValueOnce(row({ storeStatus: 'PAUSED' }));
      await expect(service.pauseStore('org-1', 'r')).rejects.toMatchObject({ status: 409 });
      repo.findById.mockResolvedValueOnce(row({ storeStatus: 'ACTIVE' }));
      await expect(service.resumeStore('org-1', 'r')).rejects.toMatchObject({ status: 409 });
      expect(repo.setStoreStatus).not.toHaveBeenCalled();
    });

    it('suspender el panel NO toca la tienda (son dimensiones independientes)', async () => {
      repo.suspend.mockResolvedValue(row({ status: 'SUSPENDED' }));
      await service.suspend('org-1', 'r');
      expect(repo.setStoreStatus).not.toHaveBeenCalled();
    });
  });
});
