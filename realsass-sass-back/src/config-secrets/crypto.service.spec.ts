import { CryptoService } from './crypto.service';

const KEY = 'a'.repeat(64);

describe('CryptoService', () => {
  const original = process.env['CONFIG_MASTER_KEY'];
  let service: CryptoService;

  beforeEach(() => {
    process.env['CONFIG_MASTER_KEY'] = KEY;
    service = new CryptoService();
  });

  afterAll(() => {
    if (original === undefined) delete process.env['CONFIG_MASTER_KEY'];
    else process.env['CONFIG_MASTER_KEY'] = original;
  });

  it('cifra y descifra (ida y vuelta)', () => {
    const p = service.encrypt('sk_live_super_secreto');
    expect(service.decrypt(p.encrypted, p.iv, p.tag)).toBe('sk_live_super_secreto');
  });

  it('el texto cifrado no contiene el secreto y guarda solo un prefijo de 4 caracteres', () => {
    const p = service.encrypt('sk_live_super_secreto');
    expect(p.encrypted).not.toContain('super_secreto');
    expect(p.prefix).toBe('sk_l');
  });

  it('usa un IV distinto en cada cifrado (mismo texto → distinto resultado)', () => {
    const a = service.encrypt('igual');
    const b = service.encrypt('igual');
    expect(a.iv).not.toBe(b.iv);
    expect(a.encrypted).not.toBe(b.encrypted);
  });

  it('seal/open es la ida y vuelta de un solo string', () => {
    const sealed = service.seal('token-123');
    expect(sealed.split('.')).toHaveLength(3);
    expect(service.open(sealed)).toBe('token-123');
  });

  it('soporta unicode', () => {
    expect(service.open(service.seal('contraseña ñandú 🔐'))).toBe('contraseña ñandú 🔐');
  });

  it('rechaza un valor sellado con formato inválido', () => {
    expect(() => service.open('solo-una-parte')).toThrow('formato inválido');
    expect(() => service.open('a.b')).toThrow('formato inválido');
  });

  it('detecta manipulación del texto cifrado (GCM autentica)', () => {
    const p = service.encrypt('no me toques');
    const tampered = Buffer.from(p.encrypted, 'base64');
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() => service.decrypt(tampered.toString('base64'), p.iv, p.tag)).toThrow();
  });

  it('detecta un tag alterado', () => {
    const p = service.encrypt('no me toques');
    const tag = Buffer.from(p.tag, 'base64');
    tag[0] = (tag[0] ?? 0) ^ 0xff;
    expect(() => service.decrypt(p.encrypted, p.iv, tag.toString('base64'))).toThrow();
  });

  it('no descifra con otra clave maestra', () => {
    const sealed = service.seal('secreto');
    process.env['CONFIG_MASTER_KEY'] = 'b'.repeat(64);
    expect(() => new CryptoService().open(sealed)).toThrow();
  });

  it.each([undefined, '', 'corta', 'a'.repeat(63), 'a'.repeat(65)])(
    'falla si CONFIG_MASTER_KEY no son 64 caracteres hex (%p)',
    (bad) => {
      if (bad === undefined) delete process.env['CONFIG_MASTER_KEY'];
      else process.env['CONFIG_MASTER_KEY'] = bad;
      expect(() => new CryptoService().encrypt('x')).toThrow('CONFIG_MASTER_KEY');
    },
  );
});
