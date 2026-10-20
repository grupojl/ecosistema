import { createHash, randomBytes } from 'node:crypto';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { DesktopLoginService } from '@/auth/desktop-login.service';

const verifierOf  = () => randomBytes(32).toString('hex');
const challengeOf = (v: string) => createHash('sha256').update(v).digest('hex');

describe('DesktopLoginService (PKCE + código de un solo uso)', () => {
  const auth  = { generateCustomTokenForUid: jest.fn() };
  const redis = { isConnected: false, set: jest.fn(), getDel: jest.fn() };
  let svc: DesktopLoginService;
  const env = { ...process.env };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...env, NODE_ENV: 'test' };
    redis.isConnected = false;
    auth.generateCustomTokenForUid.mockResolvedValue({ customToken: 'CUSTOM' });
    svc = new DesktopLoginService(redis as never, auth as never);
  });
  afterAll(() => { process.env = env; });

  it('el challenge es SHA-256 en hex: mismo vector que el test de Rust (main.rs, challenge_es_el_sha256_del_verifier)', () => {
    // Si Rust y Node calcularan distinto, el login fallaría siempre y recién se vería al compilar la app.
    expect(challengeOf('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('emite un código y lo canjea con el verifier correcto', async () => {
    const verifier = verifierOf();
    const { code, expiresIn } = await svc.issue('uid-1', challengeOf(verifier));
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresIn).toBe(60);

    await expect(svc.redeem(code, verifier)).resolves.toEqual({ customToken: 'CUSTOM' });
    expect(auth.generateCustomTokenForUid).toHaveBeenCalledWith('uid-1');
  });

  it('un código robado SIN el verifier no sirve, y queda quemado', async () => {
    const verifier = verifierOf();
    const { code } = await svc.issue('uid-1', challengeOf(verifier));

    await expect(svc.redeem(code, verifierOf())).rejects.toBeInstanceOf(UnauthorizedException);
    // ni siquiera el verifier correcto lo recupera después: era de un solo uso
    await expect(svc.redeem(code, verifier)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.generateCustomTokenForUid).not.toHaveBeenCalled();
  });

  it('un código se canjea una sola vez', async () => {
    const verifier = verifierOf();
    const { code } = await svc.issue('uid-1', challengeOf(verifier));
    await svc.redeem(code, verifier);
    await expect(svc.redeem(code, verifier)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.generateCustomTokenForUid).toHaveBeenCalledTimes(1);
  });

  it('un código vencido se rechaza', async () => {
    const verifier = verifierOf();
    const { code } = await svc.issue('uid-1', challengeOf(verifier));
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    await expect(svc.redeem(code, verifier)).rejects.toBeInstanceOf(UnauthorizedException);
    jest.restoreAllMocks();
  });

  it('rechaza challenge o verifier con formato inválido y códigos inventados', async () => {
    await expect(svc.issue('uid-1', 'no-es-hex')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.redeem('x'.repeat(43), 'corto')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.redeem('x'.repeat(43), verifierOf())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('con Redis guarda con TTL y canjea con GETDEL (atómico)', async () => {
    redis.isConnected = true;
    const verifier = verifierOf();
    const challenge = challengeOf(verifier);

    const { code } = await svc.issue('uid-9', challenge);
    expect(redis.set).toHaveBeenCalledWith(`desktop-login:${code}`, JSON.stringify({ uid: 'uid-9', challenge }), 60);

    redis.getDel.mockResolvedValue(JSON.stringify({ uid: 'uid-9', challenge }));
    await svc.redeem(code, verifier);
    expect(redis.getDel).toHaveBeenCalledWith(`desktop-login:${code}`);
    expect(auth.generateCustomTokenForUid).toHaveBeenCalledWith('uid-9');
  });

  it('en producción sin Redis falla cerrado (no usa memoria entre instancias)', async () => {
    process.env['NODE_ENV'] = 'production';
    await expect(svc.issue('uid-1', challengeOf(verifierOf()))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
