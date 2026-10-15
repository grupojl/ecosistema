import { getFirebaseAdmin } from '@real/auth-server';
import { AuthService } from '@/auth/auth.service';

// auth.service solo necesita getFirebaseAdmin de @real/auth-server (lo demás son tipos).
jest.mock('@real/auth-server', () => ({ getFirebaseAdmin: jest.fn() }));

const firebase = { createCustomToken: jest.fn(), verifyIdToken: jest.fn() };
const FB_USER = { uid: 'fb-1', email: 'ana@ejemplo.com', displayName: 'Ana', avatarUrl: null };

describe('AuthService', () => {
  const accounts = { findAccountByFirebaseUid: jest.fn(), createAccount: jest.fn(), updateAccount: jest.fn(), findAccessSummary: jest.fn() };
  const users = { buildProfile: jest.fn() };
  const affiliates = { registerReferral: jest.fn() };
  const claims = { buildClaimsFromProfile: jest.fn(), setOrgClaims: jest.fn() };
  const orgs = { ensureDefaultOrganization: jest.fn() };
  const service = new AuthService(accounts as never, users as never, affiliates as never, claims as never, orgs as never);

  const profileWithOrg = { organizations: [{ id: 'org-1', name: 'Tienda', slug: 'tienda' }], collaborations: [] };

  beforeEach(() => {
    jest.resetAllMocks();
    (getFirebaseAdmin as jest.Mock).mockReturnValue(firebase);
    orgs.ensureDefaultOrganization.mockResolvedValue({ organization: { id: 'org-1' }, created: false });
    claims.buildClaimsFromProfile.mockReturnValue({ organizationId: 'org-1', role: 'OWNER' });
    users.buildProfile.mockResolvedValue(profileWithOrg);
  });

  describe('syncUser — usuario nuevo', () => {
    beforeEach(() => {
      accounts.findAccountByFirebaseUid.mockResolvedValue(null);
      accounts.createAccount.mockImplementation((data: Record<string, unknown>) => Promise.resolve({ id: 'u-1', isOwner: false, ...data }));
    });

    it('lo crea con un código de afiliado aleatorio y no adivinable, y NO como dueño todavía', async () => {
      const out = await service.syncUser(FB_USER);

      const data = accounts.createAccount.mock.calls[0]![0] as Record<string, unknown>;
      expect(data).toMatchObject({ firebaseUid: 'fb-1', email: 'ana@ejemplo.com' }); // isOwner/isAffiliate arrancan en false (lo fija el repositorio)
      expect(data['affiliateCode']).toMatch(/^ref-[0-9a-f]{10}$/);
      expect(out.isNew).toBe(true);
    });

    it('dos usuarios nunca comparten código de afiliado', async () => {
      await service.syncUser(FB_USER);
      await service.syncUser({ ...FB_USER, uid: 'fb-2' });
      const codes = (accounts.createAccount.mock.calls as Array<[{ affiliateCode: string }]>).map(([a]) => a.affiliateCode);
      expect(new Set(codes).size).toBe(2);
    });

    it('registra el referido SI viene un código; si falla, el alta NO se rompe', async () => {
      affiliates.registerReferral.mockRejectedValue(new Error('código inexistente'));

      await expect(service.syncUser(FB_USER, 'ref-amigo')).resolves.toMatchObject({ isNew: true });
      expect(affiliates.registerReferral).toHaveBeenCalledWith('ref-amigo', 'u-1'); // (código, id del nuevo) — antes estaban invertidos
    });

    it('sin código de referido no intenta registrar nada', async () => {
      await service.syncUser(FB_USER);
      expect(affiliates.registerReferral).not.toHaveBeenCalled();
    });

    it('D1: si se creó la organización por defecto, lo marca como dueño', async () => {
      orgs.ensureDefaultOrganization.mockResolvedValue({ organization: { id: 'org-1' }, created: true });
      await service.syncUser(FB_USER);
      expect(accounts.updateAccount).toHaveBeenCalledWith('u-1', { isOwner: true });
    });

    it('emite los custom claims (ADR-003) cuando el perfil tiene organizaciones', async () => {
      await service.syncUser(FB_USER);
      expect(claims.setOrgClaims).toHaveBeenCalledWith('fb-1', { organizationId: 'org-1', role: 'OWNER' });
    });

    it('sin organizaciones ni colaboraciones NO emite claims', async () => {
      users.buildProfile.mockResolvedValue({ organizations: [], collaborations: [] });
      await service.syncUser(FB_USER);
      expect(claims.setOrgClaims).not.toHaveBeenCalled();
    });

    it('las organizaciones propias entran a los claims como OWNER (D3)', async () => {
      await service.syncUser(FB_USER);
      expect(claims.buildClaimsFromProfile).toHaveBeenCalledWith({
        tenants: [{ organizationId: 'org-1', organization: { name: 'Tienda', slug: 'tienda' }, role: 'OWNER' }],
      });
    });
  });

  describe('syncUser — usuario existente', () => {
    const existing = { id: 'u-9', email: 'ana@ejemplo.com', displayName: 'Vieja', avatarUrl: 'http://a/vieja.png', isOwner: true, affiliateCode: 'ref-abc' };
    beforeEach(() => accounts.findAccountByFirebaseUid.mockResolvedValue(existing));

    it('actualiza nombre y avatar, pero conserva lo que ya tenía si Firebase no lo trae', async () => {
      await service.syncUser({ ...FB_USER, displayName: null, avatarUrl: 'http://a/nueva.png' });
      expect(accounts.updateAccount).toHaveBeenCalledWith('u-9', { displayName: 'Vieja', avatarUrl: 'http://a/nueva.png' });
    });

    it('es idempotente y repara cuentas viejas: le genera el código de afiliado que le faltaba', async () => {
      accounts.findAccountByFirebaseUid.mockResolvedValue({ ...existing, affiliateCode: null });
      await service.syncUser(FB_USER);
      expect(accounts.updateAccount).toHaveBeenCalledWith('u-9', { affiliateCode: expect.stringMatching(/^ref-/) });
    });

    it('devuelve isNew=false y no crea otro usuario', async () => {
      expect(await service.syncUser(FB_USER)).toMatchObject({ isNew: false });
      expect(accounts.createAccount).not.toHaveBeenCalled();
    });
  });

  describe('refreshClaims', () => {
    it('reemite los claims del perfil actual', async () => {
      await service.refreshClaims('fb-1');
      expect(claims.setOrgClaims).toHaveBeenCalledWith('fb-1', expect.anything());
    });

    it('sin perfil o sin organizaciones no hace nada', async () => {
      users.buildProfile.mockResolvedValueOnce(null);
      await service.refreshClaims('fb-1');
      users.buildProfile.mockResolvedValueOnce({ organizations: [], collaborations: [] });
      await service.refreshClaims('fb-1');
      expect(claims.setOrgClaims).not.toHaveBeenCalled();
    });
  });

  describe('SSO sass-front → dashboard-front', () => {
    const owner = { email: 'ana@ejemplo.com', organizationIds: ['org-1'], activeCollaborations: 0 };
    const none  = { email: 'ana@ejemplo.com', organizationIds: [], activeCollaborations: 0 };

    it('generateCustomTokenForUid: usuario inexistente => 401; sin acceso a ninguna org => 403', async () => {
      accounts.findAccessSummary.mockResolvedValueOnce(null);
      await expect(service.generateCustomTokenForUid('fb-1')).rejects.toMatchObject({ status: 401 });
      accounts.findAccessSummary.mockResolvedValueOnce(none);
      await expect(service.generateCustomTokenForUid('fb-1')).rejects.toMatchObject({ status: 403 });
      expect(firebase.createCustomToken).not.toHaveBeenCalled();
    });

    it('emite el token con el uid de la SESIÓN (no uno que mande el cliente) y marca isOwner', async () => {
      accounts.findAccessSummary.mockResolvedValue(owner);
      firebase.createCustomToken.mockResolvedValue('custom-token');

      await expect(service.generateCustomTokenForUid('fb-1')).resolves.toEqual({ customToken: 'custom-token' });
      expect(firebase.createCustomToken).toHaveBeenCalledWith('fb-1', { isOwner: true, organizationId: 'org-1' });
    });

    it('usa la organización MÁS ANTIGUA como organizationId inicial', async () => {
      accounts.findAccessSummary.mockResolvedValue({ ...owner, organizationIds: ['vieja', 'nueva'] });
      firebase.createCustomToken.mockResolvedValue('t');
      await service.generateCustomTokenForUid('fb-1');
      expect(firebase.createCustomToken).toHaveBeenCalledWith('fb-1', { isOwner: true, organizationId: 'vieja' });
    });

    it('un colaborador ACTIVO (sin org propia) entra con isOwner=false', async () => {
      accounts.findAccessSummary.mockResolvedValue({ ...none, activeCollaborations: 1 });
      firebase.createCustomToken.mockResolvedValue('t');
      await service.generateCustomTokenForUid('fb-1');
      expect(firebase.createCustomToken).toHaveBeenCalledWith('fb-1', { isOwner: false, organizationId: null });
    });

    // Antes cualquier colaboración contaba (también REMOVED/PENDING): un colaborador removido seguía obteniendo token.
    // El repositorio ahora solo cuenta las ACTIVAS; este test fija que sin ninguna activa no hay token.
    it('un colaborador removido o pendiente (0 colaboraciones activas) NO obtiene token', async () => {
      accounts.findAccessSummary.mockResolvedValue(none);
      await expect(service.generateCustomTokenForUid('fb-1')).rejects.toMatchObject({ status: 403 });
      expect(firebase.createCustomToken).not.toHaveBeenCalled();
    });

    it('generateCustomToken: idToken inválido => 401 y no se consulta la base', async () => {
      firebase.verifyIdToken.mockRejectedValue(new Error('expired'));
      await expect(service.generateCustomToken('malo')).rejects.toMatchObject({ status: 401 });
      expect(accounts.findAccessSummary).not.toHaveBeenCalled();
    });

    it('generateCustomToken: usuario no registrado o sin acceso => 401', async () => {
      firebase.verifyIdToken.mockResolvedValue({ uid: 'fb-1' });
      accounts.findAccessSummary.mockResolvedValueOnce(null);
      await expect(service.generateCustomToken('ok')).rejects.toMatchObject({ status: 401 });
      accounts.findAccessSummary.mockResolvedValueOnce(none);
      await expect(service.generateCustomToken('ok')).rejects.toMatchObject({ status: 401 });
    });

    it('generateCustomToken: con acceso devuelve token, uid y email', async () => {
      firebase.verifyIdToken.mockResolvedValue({ uid: 'fb-1' });
      accounts.findAccessSummary.mockResolvedValue(owner);
      firebase.createCustomToken.mockResolvedValue('custom-token');
      await expect(service.generateCustomToken('ok')).resolves.toEqual({ customToken: 'custom-token', uid: 'fb-1', email: 'ana@ejemplo.com' });
      expect(accounts.findAccessSummary).toHaveBeenCalledWith('fb-1'); // el uid sale del idToken VERIFICADO
    });
  });
});
