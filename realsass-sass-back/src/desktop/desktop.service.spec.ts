import { DesktopService } from '@/desktop/desktop.service';

describe('DesktopService', () => {
  const redis = { incr: jest.fn() };
  let svc: DesktopService;
  let log: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    redis.incr.mockResolvedValue(1);
    svc = new DesktopService(redis as never);
    log = jest
      .spyOn((svc as unknown as { logger: { log: () => void } }).logger, 'log')
      .mockImplementation(() => undefined);
  });

  describe('getPolicy', () => {
    it('lee mínima, bloqueadas y descarga; ignora lo que no es x.y.z', () => {
      expect(
        svc.getPolicy({
          DESKTOP_MIN_VERSION: ' 0.2.0 ',
          DESKTOP_BLOCKED_VERSIONS: '0.1.1, 0.1.2 ,malo,1.0',
          DESKTOP_DOWNLOAD_URL: 'https://github.com/x/releases',
        }),
      ).toEqual({
        minVersion: '0.2.0',
        blockedVersions: ['0.1.1', '0.1.2'],
        downloadUrl: 'https://github.com/x/releases',
      });
    });

    it('sin variables no restringe a nadie', () => {
      expect(svc.getPolicy({})).toEqual({ minVersion: null, blockedVersions: [], downloadUrl: null });
      expect(svc.getPolicy({ DESKTOP_MIN_VERSION: 'abc' }).minVersion).toBeNull();
    });
  });

  describe('record', () => {
    const base = { kind: 'ping', version: '0.1.0', os: 'windows' } as const;

    it('cuenta por tipo/versión/so/día y deja una línea de log sin datos personales', async () => {
      await expect(svc.record(base, '1.2.3.4')).resolves.toBe(true);
      const day = new Date().toISOString().slice(0, 10);
      expect(redis.incr).toHaveBeenCalledWith(`desktop:ping:0.1.0:windows:${day}`, 90 * 24 * 60 * 60);
      const line = JSON.parse(log.mock.calls[0][0]);
      expect(line).toEqual({ event: 'desktop-telemetry', kind: 'ping', version: '0.1.0', os: 'windows' });
    });

    it('recorta el mensaje y quita saltos de línea (log injection)', async () => {
      await svc.record({ ...base, kind: 'error', message: `boom\n{"event":"fake"}\r\t${'x'.repeat(500)}` }, '1.2.3.4');
      const line = JSON.parse(log.mock.calls[0][0]);
      expect(line.message).not.toMatch(/[\r\n\t]/);
      expect(line.message.length).toBeLessThanOrEqual(300);
    });

    it('descarta sin error a quien supera el límite por minuto', async () => {
      redis.incr.mockResolvedValue(31); // contador del límite
      await expect(svc.record(base, '1.2.3.4')).resolves.toBe(false);
      expect(log).not.toHaveBeenCalled();
    });
  });
});
