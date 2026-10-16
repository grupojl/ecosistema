import { TRPCError }       from '@trpc/server';
import { SessionsService } from '@/sessions/sessions.service';

jest.mock('@real/auth-server', () => ({ SESSION_COOKIE_MAX_AGE_MS: 14 * 24 * 60 * 60 * 1000 }));

type Row = { id: string; userId: string; revokedAt: Date | null; expiresAt: Date };

function makePrisma() {
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
    userSession: {
      findUnique: jest.fn(), create: jest.fn(), update: jest.fn(),
      findMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(),
    },
  };
}

describe('SessionsService', () => {
  let prisma:  ReturnType<typeof makePrisma>;
  let service: SessionsService;

  beforeEach(() => {
    prisma  = makePrisma();
    service = new SessionsService(prisma as never);
  });

  describe('register', () => {
    it('sin sid → crea la sesión y devuelve su id', async () => {
      prisma.userSession.create.mockResolvedValue({ id: 'new-sid' });
      const sid = await service.register('fb1', { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Safari/537.36', ip: '1.2.3.4' });
      expect(sid).toBe('new-sid');
      expect(prisma.userSession.create.mock.calls[0]![0].data).toMatchObject({
        userId: 'u1', deviceType: 'desktop', ipPrefix: '1.2.3.0',
      });
    });

    it('sid vivo del mismo usuario → renueva, no crea otra fila', async () => {
      const row: Row = { id: 's1', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 1000) };
      prisma.userSession.findUnique.mockResolvedValue(row);
      expect(await service.register('fb1', {}, 's1')).toBe('s1');
      expect(prisma.userSession.update).toHaveBeenCalled();
      expect(prisma.userSession.create).not.toHaveBeenCalled();
    });

    it.each([
      ['revocado',       { revokedAt: new Date() }],
      ['vencido',        { expiresAt: new Date(Date.now() - 1000) }],
      ['de otro usuario', { userId: 'otro' }],
    ])('sid %s → crea una sesión nueva', async (_label, override) => {
      prisma.userSession.findUnique.mockResolvedValue({ id: 's1', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 1000), ...override });
      prisma.userSession.create.mockResolvedValue({ id: 'fresh' });
      expect(await service.register('fb1', {}, 's1')).toBe('fresh');
    });

    it('usuario inexistente → null (no rompe el login)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      expect(await service.register('fb1', {})).toBeNull();
    });
  });

  describe('revoke', () => {
    it('sesión propia → la revoca y queda marcada en el cache', async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      await service.revoke('fb1', 's1');
      expect(prisma.userSession.updateMany.mock.calls[0]![0].where).toMatchObject({ id: 's1', user: { firebaseUid: 'fb1' } });
      expect(await service.isRevoked('s1', 'fb1')).toBe(true);
      expect(prisma.userSession.findUnique).not.toHaveBeenCalled(); // respondió desde el cache
    });

    it('ajena o inexistente → NOT_FOUND', async () => {
      prisma.userSession.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.revoke('fb1', 'ajena')).rejects.toBeInstanceOf(TRPCError);
    });
  });

  describe('revokeOthers', () => {
    it('excluye la sesión actual y devuelve cuántas cerró', async () => {
      prisma.userSession.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      expect(await service.revokeOthers('fb1', 'actual')).toBe(2);
      expect(prisma.userSession.findMany.mock.calls[0]![0].where).toMatchObject({ id: { not: 'actual' } });
    });

    it('sin otras sesiones → 0 y no escribe', async () => {
      prisma.userSession.findMany.mockResolvedValue([]);
      expect(await service.revokeOthers('fb1', 'actual')).toBe(0);
      expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('isRevoked', () => {
    it('id desconocido → no revocado (cookies previas a ADR-020)', async () => {
      prisma.userSession.findUnique.mockResolvedValue(null);
      expect(await service.isRevoked('x', 'fb1')).toBe(false);
    });

    it('revocado en DB → true, y el segundo chequeo sale del cache', async () => {
      prisma.userSession.findUnique.mockResolvedValue({ revokedAt: new Date(), user: { firebaseUid: 'fb1' } });
      expect(await service.isRevoked('s1', 'fb1')).toBe(true);
      expect(await service.isRevoked('s1', 'fb1')).toBe(true);
      expect(prisma.userSession.findUnique).toHaveBeenCalledTimes(1);
    });

    it('sid de otro usuario → se trata como revocado', async () => {
      prisma.userSession.findUnique.mockResolvedValue({ revokedAt: null, user: { firebaseUid: 'otro' } });
      expect(await service.isRevoked('s1', 'fb1')).toBe(true);
    });

    it('la DB falla → no corta a nadie', async () => {
      prisma.userSession.findUnique.mockRejectedValue(new Error('db down'));
      expect(await service.isRevoked('s1', 'fb1')).toBe(false);
    });
  });

  it('list marca la sesión actual', async () => {
    const now = new Date();
    prisma.userSession.findMany.mockResolvedValue([
      { id: 'a', deviceType: 'desktop', browser: 'Chrome 130', os: 'Windows', ipPrefix: null, country: null, createdAt: now, lastSeenAt: now },
      { id: 'b', deviceType: 'mobile',  browser: null,         os: null,      ipPrefix: null, country: null, createdAt: now, lastSeenAt: now },
    ]);
    const res = await service.list('fb1', 'b');
    expect(res.map((s) => [s.id, s.isCurrent])).toEqual([['a', false], ['b', true]]);
  });
});
