import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { AuthService } from './auth.service';

jest.mock('firebase-admin', () => ({}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

const fbUser = { uid: 'uid-1', email: 'a@b.com', displayName: 'Ana', avatarUrl: null } as never;

const make = () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  };
  const users = { buildProfile: jest.fn() };
  const affiliates = { registerReferral: jest.fn(), ensureProfile: jest.fn() };
  const claims = { buildClaimsFromProfile: jest.fn(), setOrgClaims: jest.fn() };
  const orgs = { ensureDefaultOrganization: jest.fn().mockResolvedValue({ created: false }) };
  const svc = new AuthService(prisma as never, users as never, affiliates as never, claims as never, orgs as never);
  return { svc, prisma, users, affiliates, claims, orgs };
};

const profileWithOrg = {
  organizations: [{ id: 'o1', name: 'N', slug: 's' }],
  collaborations: [{ organizationId: 'o2', role: 'ADMIN' }],
};

describe('AuthService.syncUser', () => {
  it('usuario existente: actualiza, repara defaults y emite claims (propias como OWNER + colaboraciones)', async () => {
    const { svc, prisma, users, claims } = make();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', displayName: 'x', avatarUrl: null, isOwner: false, affiliateCode: null,
    });
    users.buildProfile.mockResolvedValue(profileWithOrg);
    claims.buildClaimsFromProfile.mockReturnValue({ ok: true });

    const out = await svc.syncUser(fbUser);

    expect(out.isNew).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { affiliateCode: expect.stringMatching(/^ref-[0-9a-f]{10}$/) } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isOwner: true } });
    expect(claims.buildClaimsFromProfile).toHaveBeenCalledWith({
      tenants: [
        { organizationId: 'o1', organization: { name: 'N', slug: 's' }, role: 'OWNER' },
        { organizationId: 'o2', organization: {}, role: 'ADMIN' },
      ],
    });
    expect(claims.setOrgClaims).toHaveBeenCalledWith('uid-1', { ok: true });
  });

  it('todo usuario queda con su perfil de afiliado (con el código existente o el recién generado)', async () => {
    const { svc, prisma, users, affiliates } = make();
    users.buildProfile.mockResolvedValue({ organizations: [], collaborations: [] });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', isOwner: true, affiliateCode: 'ref-existente' });
    await svc.syncUser(fbUser);
    expect(affiliates.ensureProfile).toHaveBeenLastCalledWith('u1', 'ref-existente');

    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u2', isOwner: true, affiliateCode: null });
    await svc.syncUser(fbUser);
    expect(affiliates.ensureProfile).toHaveBeenLastCalledWith('u2', expect.stringMatching(/^ref-[0-9a-f]{10}$/));
  });

  it('usuario existente sin organizaciones ni colaboraciones: no emite claims', async () => {
    const { svc, prisma, users, claims } = make();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', isOwner: true, affiliateCode: 'ref-1' });
    users.buildProfile.mockResolvedValue({ organizations: [], collaborations: [] });
    await svc.syncUser(fbUser);
    expect(claims.setOrgClaims).not.toHaveBeenCalled();
  });

  it('usuario nuevo: lo crea con código de afiliado, registra el referido y emite claims', async () => {
    const { svc, prisma, users, affiliates, claims, orgs } = make();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u9', email: 'a@b.com', isOwner: false, affiliateCode: 'ref-x' });
    orgs.ensureDefaultOrganization.mockResolvedValue({ created: true });
    users.buildProfile.mockResolvedValue(profileWithOrg);
    claims.buildClaimsFromProfile.mockReturnValue({ ok: true });

    const out = await svc.syncUser(fbUser, 'ref-friend');

    expect(out.isNew).toBe(true);
    expect(prisma.user.create.mock.calls[0]![0].data).toMatchObject({ firebaseUid: 'uid-1', isOwner: false });
    expect(affiliates.registerReferral).toHaveBeenCalledWith('ref-friend', 'u9');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u9' }, data: { isOwner: true } });
    expect(claims.setOrgClaims).toHaveBeenCalled();
  });

  it('un referido inválido NO rompe el alta', async () => {
    const { svc, prisma, users, affiliates } = make();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u9', isOwner: true, affiliateCode: 'ref-x' });
    affiliates.registerReferral.mockRejectedValue(new Error('código inválido'));
    users.buildProfile.mockResolvedValue({ organizations: [], collaborations: [] });
    await expect(svc.syncUser(fbUser, 'malo')).resolves.toMatchObject({ isNew: true });
  });
});

describe('AuthService.refreshClaims', () => {
  it('no hace nada sin perfil o sin membresías', async () => {
    const { svc, users, claims } = make();
    users.buildProfile.mockResolvedValueOnce(null).mockResolvedValueOnce({ organizations: [], collaborations: [] });
    await svc.refreshClaims('uid-1');
    await svc.refreshClaims('uid-1');
    expect(claims.setOrgClaims).not.toHaveBeenCalled();
  });

  it('reemite los claims cuando hay membresías', async () => {
    const { svc, users, claims } = make();
    users.buildProfile.mockResolvedValue(profileWithOrg);
    claims.buildClaimsFromProfile.mockReturnValue({ c: 1 });
    await svc.refreshClaims('uid-1');
    expect(claims.setOrgClaims).toHaveBeenCalledWith('uid-1', { c: 1 });
  });
});

describe('AuthService SSO (custom token)', () => {
  const createCustomToken = jest.fn().mockResolvedValue('TOKEN');
  const verifyIdToken = jest.fn();
  beforeEach(() => {
    createCustomToken.mockClear();
    (getAuth as jest.Mock).mockReturnValue({ createCustomToken, verifyIdToken });
  });

  it('generateCustomTokenForUid: 401 si el usuario no existe', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.generateCustomTokenForUid('uid-1')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('generateCustomTokenForUid: 403 si no tiene acceso al dashboard', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValue({ organizations: [], collaborations: [] });
    await expect(svc.generateCustomTokenForUid('uid-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it('generateCustomTokenForUid: emite el token con la org más antigua', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValue({ email: 'a@b.com', organizations: [{ id: 'o1' }], collaborations: [] });
    expect(await svc.generateCustomTokenForUid('uid-1')).toEqual({ customToken: 'TOKEN' });
    expect(createCustomToken).toHaveBeenCalledWith('uid-1', { isOwner: true, organizationId: 'o1' });
  });

  it('un colaborador sin organización propia entra con isOwner=false', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValue({ email: 'c@b.com', organizations: [], collaborations: [{}] });
    await svc.generateCustomTokenForUid('uid-2');
    expect(createCustomToken).toHaveBeenCalledWith('uid-2', { isOwner: false, organizationId: null });
  });

  it('generateCustomToken: 401 con idToken inválido', async () => {
    const { svc } = make();
    verifyIdToken.mockRejectedValue(new Error('bad'));
    await expect(svc.generateCustomToken('x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('generateCustomToken: 401 sin usuario o sin acceso, y ok con acceso', async () => {
    const { svc, prisma } = make();
    verifyIdToken.mockResolvedValue({ uid: 'uid-1' });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(svc.generateCustomToken('t')).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.user.findUnique.mockResolvedValueOnce({ organizations: [], collaborations: [] });
    await expect(svc.generateCustomToken('t')).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.user.findUnique.mockResolvedValueOnce({ email: 'a@b.com', organizations: [{ id: 'o1' }], collaborations: [] });
    expect(await svc.generateCustomToken('t')).toEqual({ customToken: 'TOKEN', uid: 'uid-1', email: 'a@b.com' });
  });
});
