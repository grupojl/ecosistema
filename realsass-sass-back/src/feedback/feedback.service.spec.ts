import { HttpException, NotFoundException } from '@nestjs/common';
import { FeedbackService, type FeedbackActor } from './feedback.service';

const owner: FeedbackActor = { organizationId: 'org-1', uid: 'u-owner', role: 'OWNER' };
const collab: FeedbackActor = { organizationId: 'org-1', uid: 'u-col', role: 'COLLABORATOR' };

const make = () => {
  const fr = {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(async (a: unknown) => a),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  return { svc: new FeedbackService({ feedbackReport: fr, forTenant: () => ({ feedbackReport: fr }) } as never), fr };
};
const req = (headers: Record<string, unknown> = {}) => ({ headers }) as never;
const input = { module: 'orders', route: '/orders', message: 'se rompe', expected: 'que ande' } as never;

describe('FeedbackService', () => {
  it('create toma organización, uid y rol del contexto y guarda el diagnóstico', async () => {
    const { svc, fr } = make();
    await svc.create(owner, input, req({ 'user-agent': 'UA', 'x-request-id': 'trace-1' }));
    const data = fr.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ organizationId: 'org-1', userUid: 'u-owner', role: 'OWNER', module: 'orders' });
    expect(data.context).toMatchObject({ userAgent: 'UA', traceId: 'trace-1' });
  });

  it('create corta a 10 reportes por hora con 429', async () => {
    const { svc, fr } = make();
    fr.count.mockResolvedValue(10);
    const err = await svc.create(owner, input, req()).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(fr.create).not.toHaveBeenCalled();
  });

  it('el OWNER lista toda la organización; el colaborador, solo lo suyo', async () => {
    const { svc, fr } = make();
    await svc.listMine(owner, { page: 2, limit: 10 });
    expect(fr.findMany.mock.calls[0]![0]).toMatchObject({ where: { organizationId: 'org-1' }, skip: 10, take: 10 });
    await svc.listMine(collab, { page: 1, limit: 10 });
    expect(fr.findMany.mock.calls[1]![0].where).toEqual({ organizationId: 'org-1', userUid: 'u-col' });
  });

  it('lo que ve el usuario nunca incluye context ni internalNote', async () => {
    const { svc, fr } = make();
    await svc.listMine(owner, { page: 1, limit: 10 });
    const select = fr.findMany.mock.calls[0]![0].select;
    expect(select).not.toHaveProperty('context');
    expect(select).not.toHaveProperty('internalNote');
  });

  it('getById: 404 si no es del alcance del actor (otra organización o de otro colaborador)', async () => {
    const { svc, fr } = make();
    fr.findFirst.mockResolvedValue(null);
    await expect(svc.getById(collab, 'r1')).rejects.toBeInstanceOf(NotFoundException);
    expect(fr.findFirst.mock.calls[0]![0].where).toEqual({ id: 'r1', organizationId: 'org-1', userUid: 'u-col' });
    fr.findFirst.mockResolvedValue({ id: 'r1' });
    expect(await svc.getById(owner, 'r1')).toEqual({ id: 'r1' });
  });

  it('internalList arma los filtros opcionales', async () => {
    const { svc, fr } = make();
    await svc.internalList({ page: 1, limit: 5, status: 'OPEN', organizationId: 'o', module: 'm', search: 'x' } as never);
    expect(fr.findMany.mock.calls[0]![0].where).toEqual({
      status: 'OPEN', organizationId: 'o', module: 'm', message: { contains: 'x', mode: 'insensitive' },
    });
    await svc.internalList({ page: 1, limit: 5 } as never);
    expect(fr.findMany.mock.calls[1]![0].where).toEqual({});
  });

  it('internalGet / internalUpdate: 404 si no existe; update solo cambia lo enviado', async () => {
    const { svc, fr } = make();
    fr.findUnique.mockResolvedValueOnce(null);
    await expect(svc.internalGet('r1')).rejects.toBeInstanceOf(NotFoundException);
    fr.findUnique.mockResolvedValue({ id: 'r1' });
    await svc.internalUpdate('r1', { internalNote: '' } as never);
    expect(fr.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { internalNote: '' } });
    await svc.internalUpdate('r1', { status: 'DONE' } as never);
    expect(fr.update).toHaveBeenLastCalledWith({ where: { id: 'r1' }, data: { status: 'DONE' } });
  });
});
