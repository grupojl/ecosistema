/**
 * Clientes HTTP del dashboard (api-client, chat-ia-client) y utilidades de formato. Lo que se verifica:
 *   · cada request lleva la sesión (credentials: include) y la organización activa
 *   · una respuesta no OK es un error (no se devuelve el cuerpo de un 500 como si fuera dato)
 *   · chat-ia reintenta UNA vez con un token renovado ante 401/403 (token vencido), y no más
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getIdToken = vi.fn()
vi.mock('@real/auth-client', () => {
  class AppError extends Error {
    constructor(public code: string, message: string) { super(message); this.name = 'AppError' }
  }
  return { getIdToken: (...a: unknown[]) => getIdToken(...a), AppError }
})

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  getIdToken.mockReset().mockResolvedValue('TOKEN')
  vi.resetModules()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('buildQuery', () => {
  it('arma el query string y omite vacíos, null y undefined', async () => {
    const { buildQuery } = await import('./api-client')
    expect(buildQuery({ page: 2, q: 'ana pérez', empty: '', none: null, undef: undefined, zero: 0, flag: false })).toBe('?page=2&q=ana+p%C3%A9rez&zero=0&flag=false')
    expect(buildQuery()).toBe('')
    expect(buildQuery({ a: undefined })).toBe('')
  })

  it('la variante de chat-ia conserva los vacíos pero omite null/undefined', async () => {
    const { buildQuery } = await import('./chat-ia-client')
    expect(buildQuery({ a: '', b: null, c: undefined, d: 1 })).toBe('?a=&d=1')
    expect(buildQuery({})).toBe('')
  })
})

describe('api-client', () => {
  it('realBackFetch usa la URL de sass-back, la sesión y la organización', async () => {
    vi.stubEnv('NEXT_PUBLIC_SASS_BACK_URL', 'http://sass.test///')
    fetchMock.mockResolvedValue(json({ ok: 1 }))
    const { realBackFetch } = await import('./api-client')
    expect(await realBackFetch.get('/organizations/me', 'org-1')).toEqual({ ok: 1 })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://sass.test/organizations/me') // sin barras de más
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' })
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'x-organization-id': 'org-1' })
    expect(init.body).toBeUndefined()
  })

  it('sin organización no manda el header x-organization-id', async () => {
    vi.stubEnv('NEXT_PUBLIC_SASS_BACK_URL', 'http://sass.test')
    fetchMock.mockResolvedValue(json({}))
    const { realBackFetch } = await import('./api-client')
    await realBackFetch.get('/x')
    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty('x-organization-id')
  })

  it.each([
    ['post', 'POST'],
    ['put', 'PUT'],
    ['patch', 'PATCH'],
  ] as const)('%s envía el cuerpo como JSON con el método %s', async (method, verb) => {
    vi.stubEnv('NEXT_PUBLIC_SASS_BACK_URL', 'http://sass.test')
    fetchMock.mockResolvedValue(json({ id: 1 }))
    const { realBackFetch } = await import('./api-client')
    await realBackFetch[method]('/entes', { name: 'Salud' }, 'org-9')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://sass.test/entes')
    expect(init.method).toBe(verb)
    expect(JSON.parse(init.body)).toEqual({ name: 'Salud' })
  })

  it('delete no manda cuerpo', async () => {
    vi.stubEnv('NEXT_PUBLIC_REAL_BACK_URL', 'http://real.test') // alias de respaldo de sass-back
    fetchMock.mockResolvedValue(json({}))
    const { realBackFetch } = await import('./api-client')
    await realBackFetch.delete('/x/1', 'org')
    expect(fetchMock.mock.calls[0]![0]).toBe('http://real.test/x/1')
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' })
    expect(fetchMock.mock.calls[0]![1].body).toBeUndefined()
  })

  it('una respuesta no OK lanza un error con método, URL y estado (no devuelve el cuerpo del error como dato)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SASS_BACK_URL', 'http://sass.test')
    fetchMock.mockResolvedValue(json({ message: 'boom' }, 500))
    const { realBackFetch } = await import('./api-client')
    await expect(realBackFetch.get('/x')).rejects.toThrow('GET http://sass.test/x → 500')
  })

  it('los servicios externos (campañas, pagos) exigen su URL configurada', async () => {
    const { apiClient } = await import('./api-client')
    expect(() => apiClient.get('campanas', '/x')).toThrow('NEXT_PUBLIC_CAMPANAS_URL no definida')
    expect(() => apiClient.get('pagos', '/x')).toThrow('NEXT_PUBLIC_PAGOS_URL no definida')
    vi.stubEnv('NEXT_PUBLIC_PAGOS_URL', 'http://pagos.test/')
    fetchMock.mockResolvedValue(json({ ok: true }))
    await apiClient.get('pagos', '/charges', 'org-1')
    expect(fetchMock.mock.calls[0]![0]).toBe('http://pagos.test/charges')
  })
})

describe('chat-ia-client', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_CHAT_IA_URL', 'http://chat.test/'))

  it('sin NEXT_PUBLIC_CHAT_IA_URL falla con un error claro', async () => {
    vi.stubEnv('NEXT_PUBLIC_CHAT_IA_URL', '')
    const { chatIaFetch } = await import('./chat-ia-client')
    await expect(chatIaFetch('/x', 'org')).rejects.toThrow('NEXT_PUBLIC_CHAT_IA_URL no definida')
  })

  it('manda Bearer + organización y devuelve el JSON', async () => {
    fetchMock.mockResolvedValue(json({ items: [] }))
    const { chatIaFetch } = await import('./chat-ia-client')
    expect(await chatIaFetch('/conversaciones', 'org-1')).toEqual({ items: [] })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://chat.test/api/v1/conversaciones')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer TOKEN', 'x-organization-id': 'org-1' })
    expect(getIdToken).toHaveBeenCalledWith(false)
  })

  it('ante 401 reintenta UNA vez con un token renovado (forzado)', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ ok: 1 }))
    getIdToken.mockResolvedValueOnce('VIEJO').mockResolvedValueOnce('NUEVO')
    const { chatIaFetch } = await import('./chat-ia-client')
    expect(await chatIaFetch('/x', 'org')).toEqual({ ok: 1 })
    expect(getIdToken.mock.calls.map((c) => c[0])).toEqual([false, true])
    expect(fetchMock.mock.calls[1]![1].headers.Authorization).toBe('Bearer NUEVO')
  })

  it('si el reintento también da 401 es un error AUTH (no hay bucle)', async () => {
    fetchMock.mockResolvedValue(json({ message: 'token inválido' }, 401))
    const { chatIaFetch } = await import('./chat-ia-client')
    await expect(chatIaFetch('/x', 'org')).rejects.toMatchObject({ code: 'AUTH', message: 'token inválido' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('un 500 es error SERVER con el mensaje del back, o uno genérico si el cuerpo no es JSON', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'se cayó' }, 500)).mockResolvedValueOnce(new Response('<html>', { status: 502 }))
    const { chatIaFetch } = await import('./chat-ia-client')
    await expect(chatIaFetch('/x', 'org')).rejects.toMatchObject({ code: 'SERVER', message: 'se cayó' })
    await expect(chatIaFetch('/x', 'org')).rejects.toMatchObject({ code: 'SERVER', message: 'chat-ia-back error 502' })
    expect(fetchMock).toHaveBeenCalledTimes(2) // un 5xx no se reintenta
  })

  it('los headers del llamador pisan a los por defecto', async () => {
    fetchMock.mockResolvedValue(json({}))
    const { chatIaFetch } = await import('./chat-ia-client')
    await chatIaFetch('/x', 'org', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hola' })
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST', body: 'hola' })
    expect(fetchMock.mock.calls[0]![1].headers['Content-Type']).toBe('text/plain')
  })
})

describe('createDashboardCaller (SSR)', () => {
  it('exige la URL de sass-back', async () => {
    vi.stubEnv('SASS_BACK_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SASS_BACK_URL', '')
    vi.stubEnv('NEXT_PUBLIC_REAL_BACK_URL', '')
    const { createDashboardCaller } = await import('./trpc/server')
    expect(() => createDashboardCaller('org-1')).toThrow('SASS_BACK_URL no está configurado')
  })

  it('manda la organización y reenvía la cookie de sesión como __session', async () => {
    vi.stubEnv('SASS_BACK_URL', 'http://sass.test///')
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ result: { data: [] } }]), { status: 200, headers: { 'content-type': 'application/json' } }))
    const { createDashboardCaller } = await import('./trpc/server')
    await createDashboardCaller('org-1', 'COOKIE-VALUE').organigrama.list.query()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('http://sass.test/api/v1/trpc/organigrama.list')
    const headers = new Headers(init.headers)
    expect(headers.get('x-organization-id')).toBe('org-1')
    expect(headers.get('cookie')).toBe('__session=COOKIE-VALUE')
  })

  it('sin cookie no manda el header cookie', async () => {
    vi.stubEnv('SASS_BACK_URL', 'http://sass.test')
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ result: { data: [] } }]), { status: 200, headers: { 'content-type': 'application/json' } }))
    const { createDashboardCaller } = await import('./trpc/server')
    await createDashboardCaller('org-1').organigrama.list.query()
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).has('cookie')).toBe(false)
  })
})
