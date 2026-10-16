import { parseDeviceInfo, truncateIp } from '@/sessions/device-info';

const CHROME_WIN  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const EDGE_WIN    = `${CHROME_WIN} Edg/130.0.0.0`;
const SAFARI_IOS  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME_ANDR = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const FIREFOX_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0';
const IPAD        = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('parseDeviceInfo', () => {
  it.each([
    [CHROME_WIN,  'desktop', 'Chrome 130',  'Windows'],
    [EDGE_WIN,    'desktop', 'Edge 130',    'Windows'],
    [SAFARI_IOS,  'mobile',  'Safari 17',   'iOS'],
    [CHROME_ANDR, 'mobile',  'Chrome 130',  'Android 14'],
    [FIREFOX_MAC, 'desktop', 'Firefox 131', 'macOS'],
    [IPAD,        'tablet',  'Safari 17',   'iOS'],
  ])('%s', (userAgent, deviceType, browser, os) => {
    expect(parseDeviceInfo({ userAgent })).toMatchObject({ deviceType, browser, os });
  });

  it('sin User-Agent → unknown, sin inventar datos', () => {
    expect(parseDeviceInfo({})).toEqual({
      deviceType: 'unknown', browser: null, os: null, ipPrefix: null, country: null,
    });
  });

  it('país: solo ISO-2 válido, en mayúsculas', () => {
    expect(parseDeviceInfo({ countryHeader: 'ar' }).country).toBe('AR');
    expect(parseDeviceInfo({ countryHeader: 'XX' }).country).toBeNull();
    expect(parseDeviceInfo({ countryHeader: 'Argentina' }).country).toBeNull();
  });
});

describe('truncateIp', () => {
  it('IPv4 → /24', () => expect(truncateIp('190.12.45.77')).toBe('190.12.45.0'));
  it('IPv4 mapeada en IPv6', () => expect(truncateIp('::ffff:10.1.2.3')).toBe('10.1.2.0'));
  it('IPv6 → /48', () => expect(truncateIp('2800:1234:5678:9abc::1')).toBe('2800:1234:5678::'));
  it('x-forwarded-for con varias IPs → la primera', () => expect(truncateIp('8.8.8.8, 10.0.0.1')).toBe('8.8.8.0'));
  it('basura → null', () => {
    expect(truncateIp('no-es-ip')).toBeNull();
    expect(truncateIp(undefined)).toBeNull();
  });
});
