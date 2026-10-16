/**
 * device-info.ts — realsass-sass-back (ADR-020)
 *
 * Deriva dispositivo/navegador/SO del User-Agent y trunca la IP. Se guarda solo el resultado:
 * nunca el User-Agent crudo ni la IP completa. Sin dependencias (ADR-018, R4).
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface DeviceInfo {
  deviceType: DeviceType;
  browser:    string | null;
  os:         string | null;
  ipPrefix:   string | null;
  country:    string | null;
}

// El orden importa: Edge/Opera/Chrome también contienen "Safari" y "Chrome" en su UA.
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(?:e|A|iOS)?\/(\d+)/,   'Edge'],
  [/OPR\/(\d+)/,               'Opera'],
  [/(?:Chrome|CriOS)\/(\d+)/,  'Chrome'],
  [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
  [/Version\/(\d+).*Safari/,   'Safari'],
];

function parseBrowser(ua: string): string | null {
  for (const [re, name] of BROWSERS) {
    const m = re.exec(ua);
    if (m) return `${name} ${m[1]}`;
  }
  return null;
}

function parseOs(ua: string): string | null {
  if (/Windows/.test(ua))          return 'Windows';
  const android = /Android (\d+)/.exec(ua);
  if (android)                     return `Android ${android[1]}`;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua))         return 'macOS';
  if (/CrOS/.test(ua))             return 'ChromeOS';
  if (/Linux/.test(ua))            return 'Linux';
  return null;
}

function parseDeviceType(ua: string): DeviceType {
  if (!ua) return 'unknown';
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/.test(ua)) return 'mobile';
  return 'desktop';
}

/** IPv4 → /24 ("190.12.45.0"), IPv6 → /48 ("2800:1234:5678::"). No reconocible → null. */
export function truncateIp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const ip = raw.split(',')[0]!.trim().replace(/^::ffff:/i, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const [a, b, c] = ip.split('.');
    return `${a}.${b}.${c}.0`;
  }
  if (ip.includes(':')) {
    const groups = ip.split(':').filter((g) => g !== '').slice(0, 3);
    return groups.length === 3 ? `${groups.join(':')}::` : null;
  }
  return null;
}

export interface RequestHints {
  userAgent?:     string;
  ip?:            string;
  /** Header del proxy (p. ej. `cf-ipcountry`). Sin proxy → no hay país. */
  countryHeader?: string;
}

export function parseDeviceInfo({ userAgent = '', ip, countryHeader }: RequestHints): DeviceInfo {
  const country = countryHeader && /^[A-Za-z]{2}$/.test(countryHeader) && countryHeader.toUpperCase() !== 'XX'
    ? countryHeader.toUpperCase()
    : null;
  return {
    deviceType: parseDeviceType(userAgent),
    browser:    parseBrowser(userAgent),
    os:         parseOs(userAgent),
    ipPrefix:   truncateIp(ip),
    country,
  };
}
