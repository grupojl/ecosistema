import { CryptoService } from '@/config-secrets/crypto.service';

describe('CryptoService (AES-256-GCM)', () => {
  const KEY = 'a'.repeat(64);
  const crypto = new CryptoService();
  let previousKey: string | undefined;

  beforeAll(() => { previousKey = process.env['CONFIG_MASTER_KEY']; process.env['CONFIG_MASTER_KEY'] = KEY; });
  afterAll(() => { if (previousKey === undefined) delete process.env['CONFIG_MASTER_KEY']; else process.env['CONFIG_MASTER_KEY'] = previousKey; });

  it('ida y vuelta con ASCII', () => {
    expect(crypto.open(crypto.seal('sk_live_1234567890'))).toBe('sk_live_1234567890');
  });

  // Regresión: decrypt hacía `Buffer + string`, que decodifica cada chunk por separado y corrompe
  // los caracteres multibyte que quedan cortados entre update() y final().
  it('ida y vuelta con caracteres multibyte y textos largos', () => {
    const text = 'contraseña ñandú 🔐 日本語 — '.repeat(200);
    expect(crypto.open(crypto.seal(text))).toBe(text);
  });

  it('cada cifrado usa un IV distinto (el mismo texto no da el mismo resultado)', () => {
    expect(crypto.seal('igual')).not.toBe(crypto.seal('igual'));
  });

  it('si se altera el cifrado, el tag GCM lo detecta y NO devuelve basura', () => {
    const [iv, tag, enc] = crypto.seal('secreto').split('.') as [string, string, string];
    const flipped = Buffer.from(enc, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() => crypto.open([iv, tag, flipped.toString('base64')].join('.'))).toThrow();
  });

  it('con otra clave maestra no se puede abrir', () => {
    const sealed = crypto.seal('secreto');
    process.env['CONFIG_MASTER_KEY'] = 'b'.repeat(64);
    try { expect(() => crypto.open(sealed)).toThrow(); } finally { process.env['CONFIG_MASTER_KEY'] = KEY; }
  });

  it('falla cerrado si la clave maestra no existe o no mide 32 bytes', () => {
    process.env['CONFIG_MASTER_KEY'] = 'corta';
    try { expect(() => crypto.seal('x')).toThrow(/32 bytes/); } finally { process.env['CONFIG_MASTER_KEY'] = KEY; }
  });

  it('un valor con formato inválido se rechaza', () => {
    expect(() => crypto.open('sin-puntos')).toThrow(/formato inválido/);
  });
});
