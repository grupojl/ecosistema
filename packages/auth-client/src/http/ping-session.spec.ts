import { afterEach, describe, expect, it, vi } from 'vitest';
import { pingSession } from './ping-session';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => fetchMock.mockReset());

const res = (status: number) => Promise.resolve({ status, ok: status >= 200 && status < 300 } as Response);

describe('pingSession', () => {
  it('200 → open', async () => {
    fetchMock.mockReturnValue(res(200));
    await expect(pingSession('http://back')).resolves.toBe('open');
  });

  it('401 → closed (sesión cerrada, vencida o revocada)', async () => {
    fetchMock.mockReturnValue(res(401));
    await expect(pingSession('http://back')).resolves.toBe('closed');
  });

  it('5xx y otros errores → unknown: nunca se desloguea por una falla del servidor', async () => {
    for (const status of [500, 502, 503, 404, 429]) {
      fetchMock.mockReturnValue(res(status));
      await expect(pingSession('http://back')).resolves.toBe('unknown');
    }
  });

  it('red caída → unknown', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(pingSession('http://back')).resolves.toBe('unknown');
  });

  it('manda la cookie y normaliza la URL (barras y sufijo /api/v1)', async () => {
    fetchMock.mockReturnValue(res(200));
    for (const base of ['http://back', 'http://back/', 'http://back/api/v1', 'http://back/api/v1/']) {
      fetchMock.mockClear();
      await pingSession(base);
      expect(fetchMock).toHaveBeenCalledWith('http://back/api/v1/trpc/auth.ping', { credentials: 'include' });
    }
  });
});
