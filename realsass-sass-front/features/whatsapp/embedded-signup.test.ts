// @vitest-environment jsdom
/**
 * Embedded Signup de Meta (ADR-025): lo que sale del navegador hacia el back es el `code` + los ids de la cuenta.
 * Invariantes de seguridad: solo se aceptan mensajes que vengan de un origen de facebook.com, y no se resuelve sin
 * el code Y los dos ids (el back verifica contra Meta que el número pertenece a esa cuenta).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type FbLogin = (cb: (r: { authResponse?: { code?: string } | null }) => void, opts: Record<string, unknown>) => void

let login: ReturnType<typeof vi.fn<FbLogin>>
const post = (data: unknown, origin = 'https://www.facebook.com') =>
  window.dispatchEvent(new MessageEvent('message', { data: typeof data === 'string' ? data : JSON.stringify(data), origin }))
const finishMsg = { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'WABA-1', phone_number_id: 'PHONE-1' } }

/** Importa el módulo limpio (guarda la promesa del SDK a nivel módulo) y simula el SDK ya cargado. */
async function load() {
  vi.resetModules()
  const mod = await import('./embedded-signup')
  login = vi.fn<FbLogin>()
  const originalAppend = document.body.appendChild.bind(document.body)
  vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => {
    if ((node as HTMLScriptElement).src?.includes('connect.facebook.net')) {
      window.FB = { init: vi.fn(), login } as never
      queueMicrotask(() => window.fbAsyncInit?.())
      return node
    }
    return originalAppend(node)
  }) as never)
  return mod
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_META_APP_ID', 'app-1')
  vi.stubEnv('NEXT_PUBLIC_META_CONFIG_ID', 'cfg-1')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete (window as { FB?: unknown }).FB
})

describe('getEmbeddedSignupConfig', () => {
  it('null si falta el app id o el config id (el botón queda deshabilitado)', async () => {
    const { getEmbeddedSignupConfig } = await load()
    vi.stubEnv('NEXT_PUBLIC_META_CONFIG_ID', '')
    expect(getEmbeddedSignupConfig()).toBeNull()
    vi.stubEnv('NEXT_PUBLIC_META_CONFIG_ID', 'cfg-1')
    vi.stubEnv('NEXT_PUBLIC_META_APP_ID', '')
    expect(getEmbeddedSignupConfig()).toBeNull()
  })

  it('con ambos devuelve la config y una versión de Graph por defecto', async () => {
    const { getEmbeddedSignupConfig } = await load()
    expect(getEmbeddedSignupConfig()).toEqual({ appId: 'app-1', configId: 'cfg-1', version: 'v21.0' })
    vi.stubEnv('NEXT_PUBLIC_META_GRAPH_VERSION', 'v23.0')
    expect(getEmbeddedSignupConfig()?.version).toBe('v23.0')
  })
})

describe('launchEmbeddedSignup', () => {
  it('sin configuración falla con un mensaje claro y no carga nada', async () => {
    const { launchEmbeddedSignup } = await load()
    vi.stubEnv('NEXT_PUBLIC_META_APP_ID', '')
    await expect(launchEmbeddedSignup()).rejects.toThrow(/NEXT_PUBLIC_META_APP_ID/)
  })

  it('resuelve con el code y los ids cuando llegan (mensaje de Meta ANTES del code)', async () => {
    const { launchEmbeddedSignup } = await load()
    login.mockImplementation((cb) => { post(finishMsg); cb({ authResponse: { code: 'CODE-1' } }) })
    await expect(launchEmbeddedSignup()).resolves.toEqual({ code: 'CODE-1', wabaId: 'WABA-1', phoneNumberId: 'PHONE-1' })
    expect(login.mock.calls[0]![1]).toMatchObject({ config_id: 'cfg-1', response_type: 'code' })
  })

  it('también resuelve si los ids llegan DESPUÉS del code', async () => {
    const { launchEmbeddedSignup } = await load()
    login.mockImplementation((cb) => { cb({ authResponse: { code: 'CODE-2' } }); setTimeout(() => post(finishMsg), 10) })
    await expect(launchEmbeddedSignup()).resolves.toMatchObject({ code: 'CODE-2', wabaId: 'WABA-1' })
  })

  it('cerrar la ventana de Meta (sin code) es «Conexión cancelada»', async () => {
    const { launchEmbeddedSignup } = await load()
    login.mockImplementation((cb) => cb({ authResponse: null }))
    await expect(launchEmbeddedSignup()).rejects.toThrow('Conexión cancelada.')
  })

  it('IGNORA mensajes de otros orígenes: un sitio ajeno no puede inyectar los ids de la cuenta', async () => {
    const { launchEmbeddedSignup } = await load()
    vi.useFakeTimers()
    login.mockImplementation((cb) => {
      post(finishMsg, 'https://evil.example.com')
      post(finishMsg, 'https://facebook.com.evil.example.com')
      cb({ authResponse: { code: 'CODE-3' } })
    })
    const result = launchEmbeddedSignup()
    const assertion = expect(result).rejects.toThrow(/Meta no entregó los datos/)
    await vi.advanceTimersByTimeAsync(5100)
    await assertion
  })

  it('sin ids tras 5 s se aborta (no se manda un code huérfano al back)', async () => {
    const { launchEmbeddedSignup } = await load()
    vi.useFakeTimers()
    login.mockImplementation((cb) => cb({ authResponse: { code: 'CODE-4' } }))
    const result = launchEmbeddedSignup()
    const assertion = expect(result).rejects.toThrow(/Repetí la conexión/)
    await vi.advanceTimersByTimeAsync(5100)
    await assertion
  })

  it('mensajes ajenos o malformados de facebook.com no rompen el flujo', async () => {
    const { launchEmbeddedSignup } = await load()
    login.mockImplementation((cb) => {
      post('esto no es json')
      post({ type: 'OTRO', event: 'FINISH' })
      post(finishMsg)
      cb({ authResponse: { code: 'CODE-5' } })
    })
    await expect(launchEmbeddedSignup()).resolves.toMatchObject({ code: 'CODE-5' })
  })

  it('un mensaje FINISH sin ids no alcanza para resolver', async () => {
    const { launchEmbeddedSignup } = await load()
    vi.useFakeTimers()
    login.mockImplementation((cb) => {
      post({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: {} })
      cb({ authResponse: { code: 'CODE-6' } })
    })
    const result = launchEmbeddedSignup()
    const assertion = expect(result).rejects.toThrow(/Meta no entregó/)
    await vi.advanceTimersByTimeAsync(5100)
    await assertion
  })
})
