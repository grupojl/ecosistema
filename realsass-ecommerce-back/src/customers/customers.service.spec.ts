import { UnprocessableEntityException } from '@nestjs/common';
import { CustomersService } from '@/customers/customers.service';
import type { CustomerRecord, ICustomersRepository } from '@/customers/repository/customers.repository.interface';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

/** Repositorio en memoria con la misma regla del esquema: un cliente por (organización, email). */
function fakeRepo(): ICustomersRepository & { rows: CustomerRecord[] } {
  const rows: CustomerRecord[] = [];
  let seq = 0;
  return {
    rows,
    async upsertByEmail(organizationId, email, patch) {
      const found = rows.find((r) => r.organizationId === organizationId && r.email === email);
      if (found) {
        if (patch.displayName !== undefined) found.displayName = patch.displayName;
        if (patch.phone !== undefined) found.phone = patch.phone;
        found.isGuest = false;
        return { customer: found, created: false };
      }
      const now = new Date();
      const customer: CustomerRecord = {
        id: `c${++seq}`, organizationId, email, displayName: patch.displayName ?? null,
        phone: patch.phone ?? null, isGuest: false, createdAt: now, updatedAt: now,
      };
      rows.push(customer);
      return { customer, created: true };
    },
    async findById(organizationId, id) { return rows.find((r) => r.id === id && r.organizationId === organizationId) ?? null; },
    async findBySessionId() { return null; },
    async update() { throw new Error('no usado'); },
    async listByOrg() { return { items: rows, total: rows.length }; },
  };
}

describe('CustomersService.identify', () => {
  it('cada email es un cliente distinto (antes todos recibían el mismo customerId)', async () => {
    const svc = new CustomersService(fakeRepo());
    const ana = await svc.identify(ORG_A, 'ana@example.com');
    const beto = await svc.identify(ORG_A, 'beto@example.com');
    expect(ana.customerId).not.toBe(beto.customerId);
  });

  it('el mismo email devuelve el mismo cliente, sin importar mayúsculas ni espacios', async () => {
    const svc = new CustomersService(fakeRepo());
    const first = await svc.identify(ORG_A, 'Ana@Example.com');
    const again = await svc.identify(ORG_A, '  ana@example.com ');
    expect(again.customerId).toBe(first.customerId);
    expect(first.isNew).toBe(true);
    expect(again.isNew).toBe(false);
  });

  it('el mismo email en otra organización es otro cliente (multi-tenant)', async () => {
    const svc = new CustomersService(fakeRepo());
    const a = await svc.identify(ORG_A, 'ana@example.com');
    const b = await svc.identify(ORG_B, 'ana@example.com');
    expect(a.customerId).not.toBe(b.customerId);
  });

  it('guarda nombre y teléfono, y un nombre nuevo actualiza al existente', async () => {
    const repo = fakeRepo();
    const svc = new CustomersService(repo);
    await svc.identify(ORG_A, 'ana@example.com', 'Ana', '123');
    await svc.identify(ORG_A, 'ana@example.com', 'Ana María');
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({ displayName: 'Ana María', phone: '123', email: 'ana@example.com' });
  });

  it('un nombre en blanco no pisa el que ya estaba', async () => {
    const repo = fakeRepo();
    const svc = new CustomersService(repo);
    await svc.identify(ORG_A, 'ana@example.com', 'Ana');
    await svc.identify(ORG_A, 'ana@example.com', '   ');
    expect(repo.rows[0]?.displayName).toBe('Ana');
  });

  it.each(['', 'no-es-un-email', 'Cliente Prueba'])('email inválido %j → 422, no crea nada', async (bad) => {
    const repo = fakeRepo();
    await expect(new CustomersService(repo).identify(ORG_A, bad)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.rows).toHaveLength(0);
  });
});
