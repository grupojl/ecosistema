import { NotFoundException } from '@nestjs/common';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { InternalOrganizationsController } from './internal-organizations.controller';
import { FeedbackInternalController } from './feedback.internal.controller';
import { MarketsInternalController } from './markets.internal.controller';
import { OrganizationsController } from '@/organizations/organizations.controller';
import { AuthController } from '@/auth/auth.controller';
import { InternalOrgActionSchema } from './schemas';

const guardsOf = (c: object) => (Reflect.getMetadata('__guards__', c) ?? []) as unknown[];

describe('controllers internos de superadmin: clave de servicio obligatoria', () => {
  it.each([
    ['InternalOrganizationsController', InternalOrganizationsController],
    ['FeedbackInternalController', FeedbackInternalController],
    ['MarketsInternalController', MarketsInternalController],
  ])('%s exige InternalApiKeyGuard', (_n, controller) => {
    expect(guardsOf(controller)).toContain(InternalApiKeyGuard);
  });
});

describe('InternalOrganizationsController', () => {
  const make = () => {
    const svc = {
      findAll: jest.fn().mockResolvedValue('list'),
      findById: jest.fn().mockResolvedValue('one'),
      suspend: jest.fn().mockResolvedValue('s'),
      unsuspend: jest.fn().mockResolvedValue('u'),
      pauseStore: jest.fn().mockResolvedValue('p'),
      resumeStore: jest.fn().mockResolvedValue('r'),
    };
    return { ctrl: new InternalOrganizationsController(svc as never), svc };
  };

  it('delega listado y detalle', async () => {
    const { ctrl, svc } = make();
    expect(await ctrl.findAll({ page: 1, limit: 10 } as never)).toBe('list');
    expect(await ctrl.findById('o1')).toBe('one');
    expect(svc.findById).toHaveBeenCalledWith('o1');
  });

  it('suspender / reactivar / pausar / reanudar pasan el motivo', async () => {
    const { ctrl, svc } = make();
    const dto = { reason: 'incumplimiento de términos' };
    await ctrl.suspend('o1', dto);
    await ctrl.unsuspend('o1', dto);
    await ctrl.pauseStore('o1', dto);
    await ctrl.resumeStore('o1', dto);
    for (const fn of [svc.suspend, svc.unsuspend, svc.pauseStore, svc.resumeStore]) {
      expect(fn).toHaveBeenCalledWith('o1', 'incumplimiento de términos');
    }
  });

  it('el motivo debe tener al menos 10 caracteres (no se puede suspender sin justificar)', () => {
    expect(InternalOrgActionSchema.safeParse({ reason: 'corto' }).success).toBe(false);
    expect(InternalOrgActionSchema.safeParse({ reason: 'motivo suficientemente largo' }).success).toBe(true);
  });
});

describe('FeedbackInternalController y MarketsInternalController', () => {
  it('delegan en sus servicios', async () => {
    const feedback = { internalList: jest.fn().mockResolvedValue('l'), internalGet: jest.fn().mockResolvedValue('g'), internalUpdate: jest.fn().mockResolvedValue('u') };
    const fc = new FeedbackInternalController(feedback as never);
    expect(await fc.list({ page: 1, limit: 5 } as never)).toBe('l');
    expect(await fc.get('r1')).toBe('g');
    expect(await fc.update('r1', { status: 'DONE' } as never)).toBe('u');
    expect(feedback.internalUpdate).toHaveBeenCalledWith('r1', { status: 'DONE' });

    const markets = { list: jest.fn().mockResolvedValue(['m']) };
    expect(await new MarketsInternalController(markets as never).getMarkets('o1')).toEqual(['m']);
    expect(markets.list).toHaveBeenCalledWith('o1');
  });
});

describe('OrganizationsController (lecturas públicas del storefront)', () => {
  const make = () => {
    const svc = {
      listPublicStores: jest.fn().mockResolvedValue([{ slug: 'a' }]),
      findByIdPublic: jest.fn(),
      findBySlugPublic: jest.fn(),
    };
    return { ctrl: new OrganizationsController(svc as never), svc };
  };

  it('lista de tiendas', async () => {
    const { ctrl } = make();
    expect(await ctrl.listStoresPublic()).toEqual([{ slug: 'a' }]);
  });

  it.each([
    ['por id', 'getByIdPublic', 'findByIdPublic'],
    ['por slug', 'getBySlugPublic', 'findBySlugPublic'],
  ] as const)('%s: devuelve la tienda o 404', async (_n, method, svcMethod) => {
    const { ctrl, svc } = make();
    svc[svcMethod].mockResolvedValueOnce(null).mockResolvedValueOnce({ slug: 'x' });
    await expect(ctrl[method]('zzz')).rejects.toBeInstanceOf(NotFoundException);
    expect(await ctrl[method]('x')).toEqual({ slug: 'x' });
  });
});

describe('AuthController', () => {
  it('organization-access consulta el acceso del usuario autenticado (no el de un uid del input)', async () => {
    const users = { getOrganizationAccess: jest.fn().mockResolvedValue({ canAccess: true }) };
    const ctrl = new AuthController({} as never, users as never);
    expect(await ctrl.getOrganizationAccess({ uid: 'uid-1' } as never, 'org-1')).toEqual({ canAccess: true });
    expect(users.getOrganizationAccess).toHaveBeenCalledWith('uid-1', 'org-1');
  });
});
