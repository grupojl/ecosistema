const setCustomUserClaims = jest.fn();
const revokeRefreshTokens = jest.fn();
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({ setCustomUserClaims, revokeRefreshTokens }) }));
jest.mock('firebase-admin', () => ({}));

import { ClaimsService, type PlatformClaims, type ProfileForClaims } from './claims.service';

const tenant = (organizationId: string, role: string, org: Record<string, unknown> = {}) => ({
  organizationId,
  organization: { name: `Org ${organizationId}`, slug: `slug-${organizationId}`, ...org },
  role,
});

describe('ClaimsService.buildClaimsFromProfile', () => {
  const service = new ClaimsService();

  it('sin organizaciones → null (no se emiten claims)', () => {
    expect(service.buildClaimsFromProfile({ tenants: [] })).toBeNull();
  });

  it('elige la organización donde es OWNER aunque no sea la primera', () => {
    const profile: ProfileForClaims = { tenants: [tenant('a', 'COLLABORATOR'), tenant('b', 'OWNER')] };
    expect(service.buildClaimsFromProfile(profile)?.organizationId).toBe('b');
  });

  it('sin OWNER usa la primera', () => {
    const profile: ProfileForClaims = { tenants: [tenant('a', 'COLLABORATOR'), tenant('b', 'COLLABORATOR')] };
    expect(service.buildClaimsFromProfile(profile)?.organizationId).toBe('a');
  });

  it('arma el shape del contrato ADR-003', () => {
    expect(service.buildClaimsFromProfile({ tenants: [tenant('o1', 'OWNER')] })).toEqual({
      organizationId: 'o1',
      organizationName: 'Org o1',
      organizationSlug: 'slug-o1',
      role: 'OWNER',
      permissions: { chat: { canRead: true, canWrite: true } },
    });
  });

  it('COLLABORATOR se traduce a MEMBER', () => {
    expect(service.buildClaimsFromProfile({ tenants: [tenant('o1', 'COLLABORATOR')] })?.role).toBe('MEMBER');
  });

  it('un rol desconocido cae al de menor privilegio (VIEWER), no a uno alto', () => {
    expect(service.buildClaimsFromProfile({ tenants: [tenant('o1', 'SUPERADMIN')] })?.role).toBe('VIEWER');
  });

  it('VIEWER puede leer el chat pero no escribir', () => {
    const c = service.buildClaimsFromProfile({ tenants: [tenant('o1', 'VIEWER')] });
    expect(c?.permissions.chat).toEqual({ canRead: true, canWrite: false });
  });

  it('sin nombre ni slug usa el id y vacío', () => {
    const c = service.buildClaimsFromProfile({ tenants: [{ organizationId: 'o1', organization: { name: null, slug: null }, role: 'OWNER' }] });
    expect(c?.organizationName).toBe('o1');
    expect(c?.organizationSlug).toBe('');
  });
});

describe('ClaimsService — Firebase', () => {
  const service = new ClaimsService();
  const claims: PlatformClaims = {
    organizationId: 'o1', organizationName: 'O', organizationSlug: 'o', role: 'OWNER', permissions: {},
  };

  beforeEach(() => { setCustomUserClaims.mockReset(); revokeRefreshTokens.mockReset(); });

  it('emite los claims para el uid', async () => {
    setCustomUserClaims.mockResolvedValue(undefined);
    await service.setOrgClaims('uid-1', claims);
    expect(setCustomUserClaims).toHaveBeenCalledWith('uid-1', claims);
  });

  it('un fallo de Firebase al emitir claims NO rompe el login', async () => {
    setCustomUserClaims.mockRejectedValue(new Error('firebase caído'));
    await expect(service.setOrgClaims('uid-1', claims)).resolves.toBeUndefined();
  });

  it('revoca los refresh tokens y tolera el fallo', async () => {
    revokeRefreshTokens.mockResolvedValue(undefined);
    await service.revokeUserTokens('uid-1');
    expect(revokeRefreshTokens).toHaveBeenCalledWith('uid-1');

    revokeRefreshTokens.mockRejectedValue(new Error('x'));
    await expect(service.revokeUserTokens('uid-1')).resolves.toBeUndefined();
  });
});
