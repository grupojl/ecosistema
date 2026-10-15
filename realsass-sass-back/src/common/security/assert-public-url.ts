import { lookup } from 'node:dns/promises';
import { isIP }       from 'node:net';

export class UnsafeUrlError extends Error {}

function isPrivateV4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||   // CGNAT
    (a === 169 && b === 254) ||             // link-local + metadata de la nube (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                                // multicast / reservado
  );
}

/** Expande una IPv6 a sus 8 grupos de 16 bits (admite "::" y un IPv4 final tipo ::ffff:1.2.3.4). null si no es válida. */
function expandIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const dotted = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted?.[1] && dotted[2]) {
    const o = dotted[2].split('.').map(Number);
    if (o.length !== 4 || o.some(n => !(n >= 0 && n <= 255))) return null;
    const [a = 0, b = 0, c = 0, d = 0] = o;
    s = dotted[1] + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail].map(h => parseInt(h, 16));
  return groups.length === 8 && groups.every(n => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? groups : null;
}

const v4of = (hi: number, lo: number): string => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

/**
 * IPv4 embebida en una IPv6. El parser de URL normaliza [::ffff:127.0.0.1] a [::ffff:7f00:1], así que hay que
 * mirar los grupos y no el texto. Cubre IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d),
 * NAT64 (64:ff9b::/96) y 6to4 (2002::/16): todos llegan a una IPv4 interna si esa IPv4 lo es.
 */
function embeddedV4(g: number[]): string | null {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0xffff || g5 === 0)) return v4of(g6, g7);
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return v4of(g6, g7);
  if (g0 === 0x2002) return v4of(g1, g2);
  return null;
}

function isPrivateV6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) return true; // no se puede interpretar => se bloquea (falla cerrado)
  const embedded = embeddedV4(g);
  if (embedded) return isPrivateV4(embedded);   // incluye :: (0.0.0.0) y ::1 (0.0.0.1)
  const [first = 0, second = 0] = g;
  return (
    (first & 0xfe00) === 0xfc00 ||              // fc00::/7  únicas locales
    (first & 0xffc0) === 0xfe80 ||              // fe80::/10 link-local
    (first & 0xff00) === 0xff00 ||              // ff00::/8  multicast
    (first === 0x2001 && second === 0) ||       // 2001::/32 Teredo (túnel hacia una IPv4 arbitraria)
    (first === 0x2001 && second === 0x0db8)     // 2001:db8::/32 documentación
  );
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) return isPrivateV6(ip);
  return true;
}

/**
 * Valida una URL que el SERVIDOR va a llamar (webhooks): evita SSRF.
 * Exige https y que el destino no resuelva a una IP privada, loopback o de metadatos de la nube.
 * En desarrollo se relaja con WEBHOOK_ALLOW_PRIVATE=true (receptor local en http://localhost).
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new UnsafeUrlError('La URL no es válida'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new UnsafeUrlError('Solo se admiten URLs http(s)');

  if (process.env['WEBHOOK_ALLOW_PRIVATE'] === 'true') return url;

  if (url.protocol !== 'https:') throw new UnsafeUrlError('La URL debe usar https');
  if (url.username || url.password) throw new UnsafeUrlError('La URL no puede incluir credenciales');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map(a => a.address);
  } catch {
    throw new UnsafeUrlError('No se pudo resolver el dominio de la URL');
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new UnsafeUrlError('La URL apunta a una dirección privada o interna');
  }
  return url;
}
