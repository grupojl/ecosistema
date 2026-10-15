import { InternalOrganizationsController } from '@/internal/internal-organizations.controller';
import type { InternalOrganizationsService } from '@/internal/internal-organizations.service';

describe('InternalOrganizationsController', () => {
  const svc = {
    findAll: jest.fn(), findById: jest.fn(), suspend: jest.fn(), unsuspend: jest.fn(), pauseStore: jest.fn(), resumeStore: jest.fn(),
  };
  const controller = new InternalOrganizationsController(svc as unknown as InternalOrganizationsService);
  const dto = { reason: 'motivo de al menos diez caracteres' };

  beforeEach(() => jest.clearAllMocks());

  it('lectura: delega listado y detalle', () => {
    controller.findAll({ page: 1, limit: 20 } as never);
    controller.findById('org-1');

    expect(svc.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(svc.findById).toHaveBeenCalledWith('org-1');
  });

  it.each([
    ['suspend', 'suspend'],
    ['unsuspend', 'unsuspend'],
    ['pauseStore', 'pauseStore'],
    ['resumeStore', 'resumeStore'],
  ] as const)('%s pasa el id y SOLO el motivo al service', (method, svcMethod) => {
    controller[method]('org-9', dto);

    expect(svc[svcMethod]).toHaveBeenCalledWith('org-9', dto.reason);
  });

  it('las dos dimensiones de control son acciones distintas: panel (suspend) y storefront (pause-store)', () => {
    controller.suspend('org-1', dto);
    expect(svc.pauseStore).not.toHaveBeenCalled();

    controller.pauseStore('org-1', dto);
    expect(svc.suspend).toHaveBeenCalledTimes(1);
  });
});
