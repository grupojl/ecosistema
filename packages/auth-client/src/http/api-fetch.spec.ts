import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getIdToken = vi.fn();
vi.mock('../firebase/firebase', () => ({ getIdToken: (force?: boolean) => getIdToken(force) }));

import { apiFetch, getActiveOrganizationId, setActiveOrganizationId } from './api-fetch';
import { AppError } from '../errors/app-error';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const res = (status: number, body: unknown = {}) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);

describe('apiFetch', () => {
  beforeEach(() => {
    getIdToken.mockReset().mockResolvedValue('tok');
    fetchMock.mockReset();
    setActiveOrganizationId(null);
  });
  afterEach(() => setActiveOrganizationId(null));

  it('agrega Authorization y desenvuelve { data }', async () => {
    fetchMock.mockReturnValue(res(200, { data: { id: 1 } }));
    await expect(apiFetch('http://x/y')).resolves.toEqual({ id: 1 });
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok');
    expect(headers['x-organization-id']).toBeUndefined();
  });

  it('si no hay envoltorio devuelve el cuerpo tal cual', async () => {
    fetchMock.mockReturnValue(res(200, { id: 2 }));
    await expect(apiFetch('http://x/y')).resolves.toEqual({ id: 2 });
  });

  it('manda x-organization-id cuando hay organización activa (solo en memoria)', async () => {
    setActiveOrganizationId('org-9');
    expect(getActiveOrganizationId()).toBe('org-9');
    fetchMock.mockReturnValue(res(200, {}));
    await apiFetch('http://x/y');
    expect(((fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>)['x-organization-id']).toBe('org-9');
  });

  it('los headers del llamador pisan a los por defecto', async () => {
    fetchMock.mockReturnValue(res(200, {}));
    await apiFetch('http://x/y', { headers: { 'Content-Type': 'text/plain' } });
    expect(((fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>)['Content-Type']).toBe('text/plain');
  });

  it('en 401 refresca el token y reintenta UNA vez', async () => {
    fetchMock.mockReturnValueOnce(res(401)).mockReturnValueOnce(res(200, { data: 'ok' }));
    await expect(apiFetch('http://x/y')).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getIdToken).toHaveBeenNthCalledWith(1, false);
    expect(getIdToken).toHaveBeenNthCalledWith(2, true);
  });

  it('si el reintento también da 401 lanza AUTH (sin bucle infinito)', async () => {
    fetchMock.mockReturnValue(res(401, { message: 'vencida' }));
    await expect(apiFetch('http://x/y')).rejects.toMatchObject({ code: 'AUTH', message: 'vencida' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, 'VALIDATION'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'CONFLICT'],
    [429, 'RATE_LIMIT'], [500, 'SERVER'], [503, 'SERVER'],
  ])('mapea HTTP %i → %s', async (status, code) => {
    fetchMock.mockReturnValue(res(status, { message: 'm' }));
    await expect(apiFetch('http://x/y')).rejects.toMatchObject({ code });
  });

  it('usa un mensaje genérico si el error no trae cuerpo', async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('sin body')) } as Response));
    await expect(apiFetch('http://x/y')).rejects.toMatchObject({ code: 'SERVER', message: 'Error 500' });
  });

  it('sin sesión de Firebase → AUTH, y no llama al servidor', async () => {
    getIdToken.mockRejectedValue(new Error('no user'));
    await expect(apiFetch('http://x/y')).rejects.toMatchObject({ code: 'AUTH' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('corte de red → NETWORK', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await apiFetch('http://x/y').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'NETWORK' });
  });
});
