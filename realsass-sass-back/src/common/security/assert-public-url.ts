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

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) {
    const l = ip.toLowerCase();
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateV4(mapped[1]);
    return l === '::' || l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') ||
           l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb');
  }
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
