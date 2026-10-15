import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * ADR-027: un rol SUPERUSER o con BYPASSRLS ignora las políticas de Row Level Security. El servicio no debe arrancar
 * en producción con un rol así (falla cerrado).
 */
describe('PrismaService.assertRlsEffective (ADR-027)', () => {
  let service: PrismaService;
  let warn: jest.SpyInstance;
  const saved = { node: process.env['NODE_ENV'], allow: process.env['ALLOW_RLS_BYPASS_ROLE'] };

  const roleIs = (role: { rolsuper: boolean; rolbypassrls: boolean } | undefined) => {
    jest.spyOn(service, '$queryRaw').mockResolvedValue(role ? [role] : []);
  };
  const check = () => (service as unknown as { assertRlsEffective(): Promise<void> }).assertRlsEffective();

  beforeEach(() => {
    service = new PrismaService();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    delete process.env['ALLOW_RLS_BYPASS_ROLE'];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (saved.node === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = saved.node;
    if (saved.allow === undefined) delete process.env['ALLOW_RLS_BYPASS_ROLE']; else process.env['ALLOW_RLS_BYPASS_ROLE'] = saved.allow;
  });

  it('con un rol común no avisa ni falla (RLS se aplica)', async () => {
    process.env['NODE_ENV'] = 'production';
    roleIs({ rolsuper: false, rolbypassrls: false });

    await expect(check()).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['SUPERUSER', { rolsuper: true, rolbypassrls: false }],
    ['BYPASSRLS', { rolsuper: false, rolbypassrls: true }],
  ])('en PRODUCCIÓN con un rol %s el servicio NO arranca', async (_name, role) => {
    process.env['NODE_ENV'] = 'production';
    roleIs(role);

    await expect(check()).rejects.toThrow(/Row Level Security NO se aplica/);
  });

  it('en producción, ALLOW_RLS_BYPASS_ROLE=true lo permite conscientemente, avisando', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['ALLOW_RLS_BYPASS_ROLE'] = 'true';
    roleIs({ rolsuper: true, rolbypassrls: false });

    await expect(check()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('fuera de producción un rol que saltea RLS solo avisa', async () => {
    process.env['NODE_ENV'] = 'development';
    roleIs({ rolsuper: true, rolbypassrls: true });

    await expect(check()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('si no encuentra el rol en pg_roles no falla', async () => {
    process.env['NODE_ENV'] = 'production';
    roleIs(undefined);

    await expect(check()).resolves.toBeUndefined();
  });
});
