// @vitest-environment jsdom
/**
 * Hooks de datos del sass-front (config, colaboradores) y utilidades de UI. Los de datos comparten dos reglas que se
 * verifican una por una:
 *   · una QUERY autenticada solo corre con la sesión lista (si no, dispara 401 antes de que exista la cookie)
 *   · una MUTACIÓN que cambia una lista invalida SU lista (si no, la pantalla muestra datos viejos)
 */
import * as React from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { path: string; kind: 'query' | 'mutation'; input?: unknown; opts?: { enabled?: boolean; staleTime?: number; onSuccess?: () => void } }

// vi.mock se eleva al inicio del archivo: lo que usa su fábrica tiene que declararse con vi.hoisted.
const { auth, calls, proxy } = vi.hoisted(() => {
  const auth = { sessionReady: true }
  const calls: Call[] = []
  /** trpc.a.b.useQuery(input, opts) / useMutation(opts): registra cada llamada y devuelve un resultado neutro. */
  const proxy = (path: string[] = []): unknown =>
    new Proxy(() => undefined, {
      get: (_t, prop: string) => {
        if (prop === 'useQuery') return (input?: unknown, opts?: Call['opts']) => { calls.push({ path: path.join('.'), kind: 'query', input, opts }); return {} }
        if (prop === 'useMutation') return (opts?: Call['opts']) => { calls.push({ path: path.join('.'), kind: 'mutation', opts }); return {} }
        return proxy([...path, prop])
      },
    })
  return { auth, calls, proxy }
})

vi.mock('@/lib/trpc/client', () => ({ trpc: proxy() }))
vi.mock('@/context/auth-context', () => ({ useAuth: () => auth }))

import * as config from './use-config'
import * as collab from './use-collaborators'
import { useImageReady } from './use-image-ready'
import { useMediaQuery } from './use-media-query'
import { useIsMobile } from './use-mobile'

let invalidate: ReturnType<typeof vi.fn>
const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = React.useMemo(() => {
    const c = new QueryClient()
    c.invalidateQueries = invalidate as never
    return c
  }, [])
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const last = () => calls.at(-1)!

beforeEach(() => {
  calls.length = 0
  auth.sessionReady = true
  invalidate = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const QUERIES: Array<[string, () => unknown, string]> = [
  ['useFeatureFlags', config.useFeatureFlags, 'configFlags.list'],
  ['useQuotas', config.useQuotas, 'configQuotas.list'],
  ['useThemes', config.useThemes, 'configThemes.list'],
  ['useWebhooks', config.useWebhooks, 'configWebhooks.list'],
  ['useSecrets', config.useSecrets, 'configSecrets.list'],
  ['useCollaborators', collab.useCollaborators, 'collaborators.list'],
]
const MUTATIONS: Array<[string, () => unknown, string, string]> = [
  ['useUpdateFeatureFlag', config.useUpdateFeatureFlag, 'configFlags.update', 'configFlags'],
  ['useUpdateQuotaLimit', config.useUpdateQuotaLimit, 'configQuotas.updateLimit', 'configQuotas'],
  ['useActivateTheme', config.useActivateTheme, 'configThemes.activate', 'configThemes'],
  ['useCreateWebhook', config.useCreateWebhook, 'configWebhooks.create', 'configWebhooks'],
  ['useDeleteWebhook', config.useDeleteWebhook, 'configWebhooks.remove', 'configWebhooks'],
  ['useCreateSecret', config.useCreateSecret, 'configSecrets.create', 'configSecrets'],
  ['useRotateSecret', config.useRotateSecret, 'configSecrets.rotate', 'configSecrets'],
  ['useRevokeSecret', config.useRevokeSecret, 'configSecrets.revoke', 'configSecrets'],
  ['useInviteCollaborator', collab.useInviteCollaborator, 'collaborators.invite', 'collaborators'],
  ['useUpdateCollaboratorPermissions', collab.useUpdateCollaboratorPermissions, 'collaborators.update', 'collaborators'],
  ['useRemoveCollaborator', collab.useRemoveCollaborator, 'collaborators.remove', 'collaborators'],
]

describe('queries autenticadas: solo con la sesión lista', () => {
  it.each(QUERIES)('%s consulta %s', (_name, hook, path) => {
    for (const ready of [true, false]) {
      calls.length = 0
      auth.sessionReady = ready
      renderHook(() => hook(), { wrapper })
      expect(last().path).toBe(path)
      expect(last().opts?.enabled, `sessionReady=${ready}`).toBe(ready)
      expect(last().opts?.staleTime).toBeGreaterThan(0)
    }
  })

  it('useWebhookLogs además exige un webhookId', () => {
    renderHook(() => config.useWebhookLogs(null), { wrapper })
    expect(last().opts?.enabled).toBe(false)
    renderHook(() => config.useWebhookLogs('w1'), { wrapper })
    expect(last()).toMatchObject({ path: 'configWebhooks.getLogs', input: { webhookId: 'w1' } })
    expect(last().opts?.enabled).toBe(true)
    auth.sessionReady = false
    renderHook(() => config.useWebhookLogs('w1'), { wrapper })
    expect(last().opts?.enabled).toBe(false)
  })

  it('useInvitationInfo no necesita sesión (el invitado aún no tiene cuenta) pero sí un token', () => {
    auth.sessionReady = false
    renderHook(() => collab.useInvitationInfo(undefined), { wrapper })
    expect(last().opts?.enabled).toBe(false)
    renderHook(() => collab.useInvitationInfo('tok'), { wrapper })
    expect(last()).toMatchObject({ path: 'collaborators.getInvitationInfo', input: { token: 'tok' } })
    expect(last().opts?.enabled).toBe(true)
  })
})

describe('mutaciones: invalidan SU lista al terminar', () => {
  it.each(MUTATIONS)('%s (%s)', (_name, hook, path, namespace) => {
    renderHook(() => hook(), { wrapper })
    expect(last()).toMatchObject({ path, kind: 'mutation' })
    last().opts?.onSuccess?.()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [[namespace, 'list']] })
  })

  it('rotar el secreto de un webhook no invalida listas (el secreto no está en la lista)', () => {
    renderHook(() => config.useRotateWebhookSecret(), { wrapper })
    expect(last().path).toBe('configWebhooks.rotateSecret')
    expect(last().opts).toBeUndefined()
  })

  it('probar un webhook refresca sus ENTREGAS, no la lista de webhooks', () => {
    renderHook(() => config.useTestWebhook(), { wrapper })
    last().opts?.onSuccess?.()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [['configWebhooks', 'getLogs']] })
  })

  it('aceptar una invitación no toca listas', () => {
    renderHook(() => collab.useAcceptInvitation(), { wrapper })
    expect(last().path).toBe('collaborators.acceptInvitation')
  })
})

describe('useImageReady', () => {
  class FakeImage {
    static instances: FakeImage[] = []
    static cached = false
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    referrerPolicy = ''
    complete = FakeImage.cached
    private _src = ''
    constructor() { FakeImage.instances.push(this) }
    get src() { return this._src }
    set src(v: string) { this._src = v }
  }
  beforeEach(() => { FakeImage.instances = []; vi.stubGlobal('Image', FakeImage) })
  afterEach(() => vi.unstubAllGlobals())

  it('sin imagen está lista al instante', () => {
    expect(renderHook(() => useImageReady(null)).result.current).toBe(true)
  })

  it('espera la carga y no manda el referrer (las fotos de Google lo rechazan)', () => {
    const { result } = renderHook(() => useImageReady('https://x/foto.png'))
    expect(result.current).toBe(false)
    expect(FakeImage.instances[0]!.referrerPolicy).toBe('no-referrer')
    act(() => FakeImage.instances[0]!.onload!())
    expect(result.current).toBe(true)
  })

  it('un error de carga NO bloquea (se muestran las iniciales)', () => {
    const { result } = renderHook(() => useImageReady('https://x/rota.png'))
    act(() => FakeImage.instances[0]!.onerror!())
    expect(result.current).toBe(true)
  })

  it('con red lenta se rinde al vencer el tiempo (el navbar no espera una foto)', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useImageReady('https://x/lenta.png', 1500))
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(1600) })
    expect(result.current).toBe(true)
  })

  it('una imagen ya en caché (complete) está lista sin esperar eventos', () => {
    FakeImage.cached = true
    const { result } = renderHook(() => useImageReady('https://x/cache.png'))
    expect(result.current).toBe(true)
    FakeImage.cached = false
  })
})

describe('useMediaQuery / useIsMobile', () => {
  type Listener = (e: { matches: boolean }) => void
  let listeners: Listener[]
  let matches: boolean
  beforeEach(() => {
    listeners = []
    matches = false
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return matches },
      addEventListener: (_: string, l: Listener) => listeners.push(l),
      removeEventListener: (_: string, l: Listener) => { listeners = listeners.filter((x) => x !== l) },
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('useMediaQuery refleja el valor inicial y los cambios, y se desuscribe al desmontar', () => {
    matches = true
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 100px)'))
    expect(result.current).toBe(true)
    act(() => listeners.forEach((l) => l({ matches: false })))
    expect(result.current).toBe(false)
    unmount()
    expect(listeners).toHaveLength(0)
  })

  it('useIsMobile usa el corte de 768 px', () => {
    vi.stubGlobal('innerWidth', 500)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
    vi.stubGlobal('innerWidth', 768)
    act(() => listeners.forEach((l) => l({ matches: false })))
    expect(result.current).toBe(false)
  })
})
