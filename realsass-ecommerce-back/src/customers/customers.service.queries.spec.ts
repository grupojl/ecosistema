import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CustomersService } from './customers.service';

const make = () => {
  const repo = {
    upsertByEmail: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    listByOrg: jest.fn(),
    anonymize: jest.fn(),
  };
  return { svc: new CustomersService(repo as never), repo };
};

describe('CustomersService: identificación, lectura y edición', () => {
  it('identify normaliza el email (trim + minúsculas) y recorta nombre/teléfono', async () => {
    const { svc, repo } = make();
    repo.upsertByEmail.mockResolvedValue({ customer: { id: 'c1' }, created: true });
    const out = await svc.identify('org', '  Ana@Mail.COM ', '  Ana ', ' 555 ');
    expect(out).toEqual({ customerId: 'c1', isNew: true });
    expect(repo.upsertByEmail).toHaveBeenCalledWith('org', 'ana@mail.com', { displayName: 'Ana', phone: '555' });
  });

  it('identify no pisa datos con cadenas vacías', async () => {
    const { svc, repo } = make();
    repo.upsertByEmail.mockResolvedValue({ customer: { id: 'c1' }, created: false });
    await svc.identify('org', 'a@b.com', '   ', '');
    expect(repo.upsertByEmail).toHaveBeenCalledWith('org', 'a@b.com', {});
  });

  it('identify rechaza un email inválido con 422 y no escribe', async () => {
    const { svc, repo } = make();
    await expect(svc.identify('org', 'no-es-email')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.upsertByEmail).not.toHaveBeenCalled();
  });

  it('findById: cliente o 404 (acotado a la organización)', async () => {
    const { svc, repo } = make();
    repo.findById.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'c1' });
    await expect(svc.findById('org', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.findById('org', 'c1')).toEqual({ id: 'c1' });
    expect(repo.findById).toHaveBeenCalledWith('org', 'c1');
  });

  it('update valida el email nuevo, exige que el cliente exista y actualiza', async () => {
    const { svc, repo } = make();
    await expect(svc.update('org', 'c1', { email: 'malo' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    repo.findById.mockResolvedValueOnce(null);
    await expect(svc.update('org', 'c1', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();

    repo.findById.mockResolvedValue({ id: 'c1' });
    repo.update.mockResolvedValue({ id: 'c1', displayName: 'Nuevo' });
    expect(await svc.update('org', 'c1', { email: 'ok@x.com', name: 'Nuevo' })).toEqual({ id: 'c1', displayName: 'Nuevo' });
    expect(repo.update).toHaveBeenCalledWith('org', 'c1', { email: 'ok@x.com', name: 'Nuevo' });
  });

  it('anonymize: ok si existía; 404 si el cliente no es de esa organización', async () => {
    const { svc, repo } = make();
    repo.anonymize.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await svc.anonymize('org', 'c1')).toMatchObject({ ok: true, anonymizedAt: expect.any(String) });
    expect(repo.anonymize).toHaveBeenCalledWith('org', 'c1');
    await expect(svc.anonymize('org', 'otro')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listByOrg delega con la organización y los filtros', async () => {
    const { svc, repo } = make();
    repo.listByOrg.mockResolvedValue({ data: [], total: 0 });
    await svc.listByOrg('org', { search: 'ana', page: 2, limit: 5 });
    expect(repo.listByOrg).toHaveBeenCalledWith('org', { search: 'ana', page: 2, limit: 5 });
  });
});
