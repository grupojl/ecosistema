import { CustomersService } from '@/customers/customers.service';
import type { CustomerSessionService } from '@/customers/customer-session.service';
import type { CustomerRecord, ICustomersRepository } from '@/customers/repository/customers.repository.interface';

const customer = (over: Partial<CustomerRecord> = {}): CustomerRecord => ({
  id: 'c-1', organizationId: 'org-1', email: 'guest_x@guest.local', displayName: null, phone: null, isGuest: true,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe('CustomersService', () => {
  const repo = { createGuest: jest.fn(), findById: jest.fn(), attachContact: jest.fn(), update: jest.fn(), listByOrg: jest.fn(), anonymize: jest.fn() };
  const sessions = { issue: jest.fn(), verify: jest.fn() };
  const service = new CustomersService(repo as unknown as ICustomersRepository, sessions as unknown as CustomerSessionService);

  beforeEach(() => {
    jest.resetAllMocks();
    sessions.issue.mockReturnValue({ token: 'tok', expiresAt: new Date('2027-01-01') });
    repo.attachContact.mockImplementation((_o: string, id: string) => Promise.resolve(customer({ id })));
  });

  describe('identify', () => {
    it('sin sesión previa crea un invitado NUEVO y emite su token', async () => {
      repo.createGuest.mockResolvedValue(customer({ id: 'nuevo' }));

      const out = await service.identify('org-1', null);

      expect(out).toEqual({ customerId: 'nuevo', isNew: true, token: 'tok', expiresAt: new Date('2027-01-01') });
      expect(sessions.issue).toHaveBeenCalledWith({ customerId: 'nuevo', organizationId: 'org-1' });
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('con sesión válida de la MISMA organización continúa esa sesión (no crea otro cliente)', async () => {
      repo.findById.mockResolvedValue(customer({ id: 'c-7' }));

      const out = await service.identify('org-1', { customerId: 'c-7', organizationId: 'org-1' });

      expect(out).toMatchObject({ customerId: 'c-7', isNew: false });
      expect(repo.createGuest).not.toHaveBeenCalled();
    });

    it('una sesión de OTRA organización se ignora: se crea un invitado nuevo en ésta', async () => {
      repo.createGuest.mockResolvedValue(customer({ id: 'nuevo' }));

      const out = await service.identify('org-1', { customerId: 'c-7', organizationId: 'org-OTRA' });

      expect(out).toMatchObject({ customerId: 'nuevo', isNew: true });
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('una sesión cuyo cliente ya no existe (borrado) crea un invitado nuevo', async () => {
      repo.findById.mockResolvedValue(null);
      repo.createGuest.mockResolvedValue(customer({ id: 'nuevo' }));

      expect(await service.identify('org-1', { customerId: 'fantasma', organizationId: 'org-1' })).toMatchObject({ customerId: 'nuevo', isNew: true });
    });

    it('rechaza un email inválido (422) sin tocar la base', async () => {
      await expect(service.identify('org-1', null, { email: 'no-es-email' })).rejects.toMatchObject({ status: 422 });
      expect(repo.createGuest).not.toHaveBeenCalled();
    });

    it('los datos de contacto se guardan sobre el cliente de la sesión (nunca se busca por email)', async () => {
      repo.createGuest.mockResolvedValue(customer({ id: 'nuevo' }));
      await service.identify('org-1', null, { email: 'ana@ejemplo.com', displayName: 'Ana', phone: '123' });

      expect(repo.attachContact).toHaveBeenCalledWith('org-1', 'nuevo', { email: 'ana@ejemplo.com', displayName: 'Ana', phone: '123' });
    });
  });

  describe('findById / update', () => {
    it('findById lanza NotFound si no existe en esa organización', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('org-1', 'c-x')).rejects.toMatchObject({ status: 404 });
    });

    it('update valida el email y exige que el cliente exista', async () => {
      await expect(service.update('org-1', 'c-1', { email: 'mal' })).rejects.toMatchObject({ status: 422 });

      repo.findById.mockResolvedValue(null);
      await expect(service.update('org-1', 'c-1', { displayName: 'Ana' })).rejects.toMatchObject({ status: 404 });
      expect(repo.update).not.toHaveBeenCalled();

      repo.findById.mockResolvedValue(customer());
      repo.update.mockResolvedValue(customer({ displayName: 'Ana' }));
      await service.update('org-1', 'c-1', { displayName: 'Ana' });
      expect(repo.update).toHaveBeenCalledWith('org-1', 'c-1', { displayName: 'Ana' });
    });
  });

  it('listByOrg delega con los filtros', async () => {
    repo.listByOrg.mockResolvedValue({ items: [], total: 0 });
    await service.listByOrg('org-1', { search: 'ana', page: 2 });
    expect(repo.listByOrg).toHaveBeenCalledWith('org-1', { search: 'ana', page: 2 });
  });

  describe('deleteAccount (GDPR/LGPD)', () => {
    it('anonimiza la cuenta de la sesión y devuelve cuándo', async () => {
      repo.anonymize.mockResolvedValue(true);

      const out = await service.deleteAccount('org-1', 'c-1');

      expect(repo.anonymize).toHaveBeenCalledWith('org-1', 'c-1');
      expect(out.anonymizedAt).toBeInstanceOf(Date);
    });

    it('un cliente que no existe en la organización responde NotFound (404)', async () => {
      repo.anonymize.mockResolvedValue(false);

      await expect(service.deleteAccount('org-1', 'fantasma')).rejects.toMatchObject({ status: 404 });
    });
  });
});
