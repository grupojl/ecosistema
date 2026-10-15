import { ClaimsService, type PlatformClaims } from '@/auth/claims.service';

const admin = { setCustomUserClaims: jest.fn(), revokeRefreshTokens: jest.fn() };
jest.mock('@real/auth-server', () => ({ getFirebaseAdmin: () => admin }));

const tenant = (role: string, id = 'org-1', org: Record<string, unknown> = { name: 'Acme', slug: 'acme' }) => ({ organizationId: id, organization: org, role });

describe('ClaimsService (ADR-003: custom claims de Firebase)', () => {
  const service = new ClaimsService();

  beforeEach(() => jest.clearAllMocks());

  describe('buildClaimsFromProfile', () => {
    it('sin organizaciones => null (no se emite nada)', () => {
      expect(service.buildClaimsFromProfile({ tenants: [] })).toBeNull();
    });

    it('el OWNER tiene prioridad aunque no sea el primero', () => {
      const claims = service.buildClaimsFromProfile({ tenants: [tenant('COLLABORATOR', 'org-a'), tenant('OWNER', 'org-b')] });

      expect(claims).toMatchObject({ organizationId: 'org-b', role: 'OWNER' });
    });

    it('sin OWNER usa la primera organización', () => {
      const claims = service.buildClaimsFromProfile({ tenants: [tenant('COLLABORATOR', 'org-a'), tenant('VIEWER', 'org-b')] });

      expect(claims?.organizationId).toBe('org-a');
    });

    it('COLLABORATOR se emite como MEMBER; un rol desconocido cae al mínimo privilegio (VIEWER)', () => {
      expect(service.buildClaimsFromProfile({ tenants: [tenant('COLLABORATOR')] })?.role).toBe('MEMBER');
      expect(service.buildClaimsFromProfile({ tenants: [tenant('SUPERADMN')] })?.role).toBe('VIEWER');
    });

    it('VIEWER lee pero no escribe en chat; el resto sí escribe', () => {
      expect(service.buildClaimsFromProfile({ tenants: [tenant('VIEWER')] })?.permissions.chat).toEqual({ canRead: true, canWrite: false });
      expect(service.buildClaimsFromProfile({ tenants: [tenant('OWNER')] })?.permissions.chat).toEqual({ canRead: true, canWrite: true });
    });

    it('sin nombre o slug usa el id / cadena vacía en lugar de null', () => {
      const claims = service.buildClaimsFromProfile({ tenants: [tenant('OWNER', 'org-7', { name: null, slug: null })] });

      expect(claims).toMatchObject({ organizationName: 'org-7', organizationSlug: '' });
    });
  });

  describe('emisión y revocación (nunca rompen el login)', () => {
    const claims: PlatformClaims = { organizationId: 'org-1', organizationName: 'Acme', organizationSlug: 'acme', role: 'OWNER', permissions: {} };

    it('setOrgClaims emite los claims en Firebase', async () => {
      admin.setCustomUserClaims.mockResolvedValue(undefined);

      await service.setOrgClaims('u1', claims);

      expect(admin.setCustomUserClaims).toHaveBeenCalledWith('u1', claims);
    });

    it('si Firebase falla, setOrgClaims y revokeUserTokens no lanzan', async () => {
      admin.setCustomUserClaims.mockRejectedValue(new Error('quota'));
      admin.revokeRefreshTokens.mockRejectedValue(new Error('quota'));

      await expect(service.setOrgClaims('u1', claims)).resolves.toBeUndefined();
      await expect(service.revokeUserTokens('u1')).resolves.toBeUndefined();
    });

    it('revokeUserTokens revoca los refresh tokens del uid', async () => {
      admin.revokeRefreshTokens.mockResolvedValue(undefined);

      await service.revokeUserTokens('u1');

      expect(admin.revokeRefreshTokens).toHaveBeenCalledWith('u1');
    });
  });
});
