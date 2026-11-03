import { ConflictException, NotFoundException } from '@nestjs/common';
import { InternalOrganizationsService } from './internal-organizations.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'o1', ecosystemId: null, name: 'Org', slug: 'org', status: 'ACTIVE', storeStatus: 'ACTIVE', plan: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), suspendedAt: null, ...over,
});

const make = () => {
  const organization = { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() };
  return { svc: new InternalOrganizationsService({ organization } as never), organization };
};

describe('InternalOrganizationsService (superadmin)', () => {
  it('findAll pagina, filtra y busca por nombre o slug sin distinguir mayúsculas', async () => {
    const { svc, organization } = make();
    organization.findMany.mockResolvedValue([row()]);
    organization.count.mockResolvedValue(41);
    const out = await svc.findAll({ page: 3, limit: 10, status: 'ACTIVE', ecosystemId: 'welver', search: 'AbC' } as never);
    expect(organization.findMany.mock.calls[0]![0]).toMatchObject({
      skip: 20, take: 10,
      where: {
        status: 'ACTIVE', ecosystemId: 'welver',
        OR: [{ name: { contains: 'AbC', mode: 'insensitive' } }, { slug: { contains: 'AbC', mode: 'insensitive' } }],
      },
    });
    expect(out).toMatchObject({ total: 41, page: 3, limit: 10 });
  });

  it('toItem completa los valores por defecto (ecosistema welver, plan free) y serializa fechas', async () => {
    const { svc, organization } = make();
    organization.findUnique.mockResolvedValue(row({ suspendedAt: new Date('2026-02-02T00:00:00Z') }));
    expect(await svc.findById('o1')).toMatchObject({
      ecosystemId: 'welver', plan: 'free', createdAt: '2026-01-01T00:00:00.000Z', suspendedAt: '2026-02-02T00:00:00.000Z',
    });
  });

  it('findById: 404 si no existe', async () => {
    const { svc, organization } = make();
    organization.findUnique.mockResolvedValue(null);
    await expect(svc.findById('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe.each([
    ['suspend', { status: 'ACTIVE' }, { status: 'SUSPENDED' }, [{ status: 'SUSPENDED' }, { status: 'BLOCKED' }]],
    ['unsuspend', { status: 'SUSPENDED' }, { status: 'ACTIVE', suspendedAt: null }, [{ status: 'ACTIVE' }, { status: 'BLOCKED' }]],
    ['pauseStore', { storeStatus: 'ACTIVE' }, { storeStatus: 'PAUSED' }, [{ storeStatus: 'PAUSED' }]],
    ['resumeStore', { storeStatus: 'PAUSED' }, { storeStatus: 'ACTIVE' }, [{ storeStatus: 'ACTIVE' }]],
  ] as const)('%s', (op, validState, expectedData, invalidStates) => {
    it('aplica el cambio de estado válido', async () => {
      const { svc, organization } = make();
      organization.findUnique.mockResolvedValue({ id: 'o1', ...validState });
      organization.update.mockResolvedValue(row());
      await svc[op]('o1', 'motivo');
      expect(organization.update.mock.calls[0]![0].data).toMatchObject(expectedData);
    });

    it('404 si la organización no existe', async () => {
      const { svc, organization } = make();
      organization.findUnique.mockResolvedValue(null);
      await expect(svc[op]('x', 'm')).rejects.toBeInstanceOf(NotFoundException);
      expect(organization.update).not.toHaveBeenCalled();
    });

    it.each(invalidStates)('409 y no escribe si el estado actual es %j', async (state) => {
      const { svc, organization } = make();
      organization.findUnique.mockResolvedValue({ id: 'o1', ...state });
      await expect(svc[op]('o1', 'm')).rejects.toBeInstanceOf(ConflictException);
      expect(organization.update).not.toHaveBeenCalled();
    });
  });

  it('suspend registra suspendedAt con la fecha actual', async () => {
    const { svc, organization } = make();
    organization.findUnique.mockResolvedValue({ id: 'o1', status: 'ACTIVE' });
    organization.update.mockResolvedValue(row());
    await svc.suspend('o1', 'impago');
    expect(organization.update.mock.calls[0]![0].data.suspendedAt).toBeInstanceOf(Date);
  });
});
