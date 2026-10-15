import { PrismaCustomersRepository } from '@/customers/repository/prisma-customers.repository';
import type { PrismaService } from '@/prisma/prisma.service';

describe('PrismaCustomersRepository.anonymize (GDPR/LGPD)', () => {
  const tx = {
    storeCustomer: { findFirst: jest.fn(), update: jest.fn() },
    customerAddress: { deleteMany: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  const repo = new PrismaCustomersRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  });

  it('borra las direcciones y reemplaza los datos personales por valores anónimos, en una transacción', async () => {
    tx.storeCustomer.findFirst.mockResolvedValue({ id: 'c-1' });

    expect(await repo.anonymize('org-1', 'c-1')).toBe(true);

    expect(tx.storeCustomer.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c-1', organizationId: 'org-1' } }));
    expect(tx.customerAddress.deleteMany).toHaveBeenCalledWith({ where: { customerId: 'c-1' } });
    const data = (tx.storeCustomer.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ displayName: null, phone: null, isGuest: true });
    expect(data['email']).toMatch(/^deleted_.+@deleted\.local$/);
  });

  it('cada anonimización genera un email distinto (la columna es única por organización)', async () => {
    tx.storeCustomer.findFirst.mockResolvedValue({ id: 'c-1' });

    await repo.anonymize('org-1', 'c-1');
    await repo.anonymize('org-1', 'c-1');

    const emails = tx.storeCustomer.update.mock.calls.map((c) => (c[0] as { data: { email: string } }).data.email);
    expect(new Set(emails).size).toBe(2);
  });

  it('un cliente que no es de la organización devuelve false y no borra ni modifica nada', async () => {
    tx.storeCustomer.findFirst.mockResolvedValue(null);

    expect(await repo.anonymize('org-1', 'c-ajeno')).toBe(false);
    expect(tx.customerAddress.deleteMany).not.toHaveBeenCalled();
    expect(tx.storeCustomer.update).not.toHaveBeenCalled();
  });
});
