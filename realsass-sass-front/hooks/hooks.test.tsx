// @vitest-environment jsdom
/**
 * Hooks del sass-front con lógica propia: re-autenticación (step-up), SSO al dashboard, acciones de WhatsApp y el
 * reducer de toasts. Los hooks de tRPC/auth se simulan; se prueba lo que hacen con ellos.
 */
import * as React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = { reauthenticate: vi.fn(), sessionReady: true }
const sso = { mutateAsync: vi.fn() }
const whatsapp = { connect: { mutateAsync: vi.fn() }, disconnect: { mutateAsync: vi.fn() }, status: { useQuery: vi.fn() } }
const launchEmbeddedSignup = vi.fn()

vi.mock('@/context/auth-context', () => ({ useAuth: () => auth }))
vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    auth: { createDashboardSso: { useMutation: () => sso } },
    whatsapp: {
      status: { useQuery: (...a: unknown[]) => whatsapp.status.useQuery(...a) },
      connect: { useMutation: () => whatsapp.connect },
      disconnect: { useMutation: () => whatsapp.disconnect },
    },
  },
}))
vi.mock('@/features/whatsapp/embedded-signup', () => ({ launchEmbeddedSignup: () => launchEmbeddedSignup() }))

import { useStepUp } from './use-step-up'
import { reducer } from './use-toast'

beforeEach(() => {
  auth.reauthenticate = vi.fn().mockResolvedValue(undefined)
  auth.sessionReady = true
  sso.mutateAsync = vi.fn()
  whatsapp.connect.mutateAsync = vi.fn().mockResolvedValue({ ok: true })
  whatsapp.disconnect.mutateAsync = vi.fn().mockResolvedValue({ ok: true })
  launchEmbeddedSignup.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const reauthError = () => ({ data: { appCode: 'REAUTH_REQUIRED' } })

describe('useStepUp (re-autenticación para acciones sensibles)', () => {
  it('si la acción funciona a la primera, NO pide re-autenticar', async () => {
    const { result } = renderHook(() => useStepUp())
    const run = vi.fn().mockResolvedValue('ok')
    expect(await result.current(run)).toBe('ok')
    expect(run).toHaveBeenCalledTimes(1)
    expect(auth.reauthenticate).not.toHaveBeenCalled()
  })

  it('con REAUTH_REQUIRED re-autentica UNA vez y reintenta', async () => {
    const { result } = renderHook(() => useStepUp())
    const run = vi.fn().mockRejectedValueOnce(reauthError()).mockResolvedValueOnce('listo')
    expect(await result.current(run)).toBe('listo')
    expect(auth.reauthenticate).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('cualquier otro error se propaga sin re-autenticar', async () => {
    const { result } = renderHook(() => useStepUp())
    const boom = new Error('otro error')
    await expect(result.current(vi.fn().mockRejectedValue(boom))).rejects.toBe(boom)
    expect(auth.reauthenticate).not.toHaveBeenCalled()
    await expect(result.current(vi.fn().mockRejectedValue({ data: { appCode: 'QUOTA_EXCEEDED' } }))).rejects.toBeDefined()
    expect(auth.reauthenticate).not.toHaveBeenCalled()
  })

  it('si el reintento vuelve a pedir re-autenticación, falla (no hay bucle infinito)', async () => {
    const { result } = renderHook(() => useStepUp())
    const run = vi.fn().mockRejectedValue(reauthError())
    await expect(result.current(run)).rejects.toMatchObject({ data: { appCode: 'REAUTH_REQUIRED' } })
    expect(run).toHaveBeenCalledTimes(2)
    expect(auth.reauthenticate).toHaveBeenCalledTimes(1)
  })

  it('si el usuario cancela la re-autenticación, no se ejecuta la acción otra vez', async () => {
    auth.reauthenticate = vi.fn().mockRejectedValue(new Error('cancelado'))
    const { result } = renderHook(() => useStepUp())
    const run = vi.fn().mockRejectedValue(reauthError())
    await expect(result.current(run)).rejects.toThrow('cancelado')
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('useDashboardSSO', () => {
  async function load() {
    vi.resetModules()
    return (await import('./use-dashboard-sso')).useDashboardSSO
  }
  const fakeTab = () => ({ opener: 'x' as unknown, closed: false, close: vi.fn(), location: { href: '' } })

  it('sin NEXT_PUBLIC_DASHBOARD_FRONT_URL falla con un mensaje claro y vuelve a idle', async () => {
    vi.stubEnv('NEXT_PUBLIC_DASHBOARD_FRONT_URL', '')
    vi.useFakeTimers()
    const useDashboardSSO = await load()
    const { result } = renderHook(() => useDashboardSSO())
    await act(async () => { await result.current.openDashboard() })
    expect(result.current.state).toBe('error')
    expect(result.current.ssoError).toMatch(/NEXT_PUBLIC_DASHBOARD_FRONT_URL/)
    await act(async () => { vi.advanceTimersByTime(5100) })
    expect(result.current.state).toBe('idle')
    expect(result.current.ssoError).toBeNull()
  })

  it('abre el dashboard en la pestaña ya abierta con el token codificado y sin dejar `opener`', async () => {
    vi.stubEnv('NEXT_PUBLIC_DASHBOARD_FRONT_URL', 'https://dash.example.com//')
    vi.useFakeTimers()
    const tab = fakeTab()
    vi.spyOn(window, 'open').mockReturnValue(tab as never)
    sso.mutateAsync.mockResolvedValue({ customToken: 'a b+c/d' })
    const useDashboardSSO = await load()
    const { result } = renderHook(() => useDashboardSSO())

    await act(async () => { await result.current.openDashboard() })
    expect(tab.opener).toBeNull() // la pestaña nueva no puede manipular a la que la abrió
    expect(result.current.state).toBe('success')
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(tab.location.href).toBe('https://dash.example.com/auth/sso?token=a%20b%2Bc%2Fd') // sin barras dobles, token escapado
    expect(result.current.state).toBe('idle')
  })

  it('si el popup fue bloqueado, navega en esta misma pestaña', async () => {
    vi.stubEnv('NEXT_PUBLIC_DASHBOARD_FRONT_URL', 'https://dash.example.com')
    vi.useFakeTimers()
    vi.spyOn(window, 'open').mockReturnValue(null)
    const assign = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, set href(v: string) { assign(v) }, get href() { return '' } } })
    sso.mutateAsync.mockResolvedValue({ customToken: 'T' })
    const useDashboardSSO = await load()
    const { result } = renderHook(() => useDashboardSSO())
    await act(async () => { await result.current.openDashboard() })
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(assign).toHaveBeenCalledWith('https://dash.example.com/auth/sso?token=T')
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })

  it('si falla el back, cierra la pestaña en blanco y muestra el error', async () => {
    vi.stubEnv('NEXT_PUBLIC_DASHBOARD_FRONT_URL', 'https://dash.example.com')
    vi.useFakeTimers()
    const tab = fakeTab()
    vi.spyOn(window, 'open').mockReturnValue(tab as never)
    sso.mutateAsync.mockRejectedValue(new Error('El usuario no tiene acceso al dashboard.'))
    const useDashboardSSO = await load()
    const { result } = renderHook(() => useDashboardSSO())
    await act(async () => { await result.current.openDashboard() })
    expect(tab.close).toHaveBeenCalled()
    expect(result.current.state).toBe('error')
    expect(result.current.ssoError).toContain('no tiene acceso')
  })

  it('espera a que la sesión esté lista antes de pedir el token (hasta 8 s) y falla si nunca lo está', async () => {
    vi.stubEnv('NEXT_PUBLIC_DASHBOARD_FRONT_URL', 'https://dash.example.com')
    vi.useFakeTimers()
    auth.sessionReady = false
    vi.spyOn(window, 'open').mockReturnValue(fakeTab() as never)
    const useDashboardSSO = await load()
    const { result } = renderHook(() => useDashboardSSO())
    let done = false
    act(() => { void result.current.openDashboard().then(() => { done = true }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(8100) })
    expect(done).toBe(true)
    expect(sso.mutateAsync).not.toHaveBeenCalled()
    expect(result.current.ssoError).toMatch(/todavía se está preparando/)
  })
})

describe('hooks de WhatsApp (conectar / desconectar)', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  )
  async function load() {
    vi.resetModules()
    return await import('@/features/whatsapp/hooks')
  }

  it('conectar: lanza el signup de Meta y manda el resultado al back POR step-up', async () => {
    launchEmbeddedSignup.mockResolvedValue({ code: 'C', wabaId: 'W', phoneNumberId: 'P' })
    const { useConnectWhatsapp } = await load()
    const { result } = renderHook(() => useConnectWhatsapp(), { wrapper })
    let ok = false
    await act(async () => { ok = await result.current.start() })
    expect(ok).toBe(true)
    expect(whatsapp.connect.mutateAsync).toHaveBeenCalledWith({ code: 'C', wabaId: 'W', phoneNumberId: 'P' })
    expect(result.current.error).toBeNull()
  })

  it('si la conexión falla devuelve false y guarda el error (no lanza)', async () => {
    launchEmbeddedSignup.mockRejectedValue(new Error('Conexión cancelada.'))
    const { useConnectWhatsapp } = await load()
    const { result } = renderHook(() => useConnectWhatsapp(), { wrapper })
    let ok = true
    await act(async () => { ok = await result.current.start() })
    expect(ok).toBe(false)
    expect((result.current.error as Error).message).toBe('Conexión cancelada.')
    expect(whatsapp.connect.mutateAsync).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('desconectar pide step-up con la cuenta indicada', async () => {
    const { useDisconnectWhatsapp } = await load()
    const { result } = renderHook(() => useDisconnectWhatsapp(), { wrapper })
    await act(async () => { await result.current.start('acc-1') })
    expect(whatsapp.disconnect.mutateAsync).toHaveBeenCalledWith({ accountId: 'acc-1' })
  })

  it('una acción exitosa limpia el error anterior', async () => {
    launchEmbeddedSignup.mockRejectedValueOnce(new Error('falló')).mockResolvedValueOnce({ code: 'C', wabaId: 'W', phoneNumberId: 'P' })
    const { useConnectWhatsapp } = await load()
    const { result } = renderHook(() => useConnectWhatsapp(), { wrapper })
    await act(async () => { await result.current.start() })
    expect(result.current.error).not.toBeNull()
    await act(async () => { await result.current.start() })
    expect(result.current.error).toBeNull()
  })

  it('useWhatsappConnection consulta sin reintentos', async () => {
    whatsapp.status.useQuery.mockReturnValue({ data: null })
    const { useWhatsappConnection } = await load()
    renderHook(() => useWhatsappConnection(), { wrapper })
    expect(whatsapp.status.useQuery).toHaveBeenCalledWith(undefined, { retry: false })
  })
})

describe('reducer de toasts', () => {
  const t = (id: string, extra = {}) => ({ id, open: true, ...extra }) as never
  const empty = { toasts: [] }

  it('ADD_TOAST agrega al principio y respeta el límite', () => {
    let s = reducer(empty as never, { type: 'ADD_TOAST', toast: t('1') } as never)
    s = reducer(s, { type: 'ADD_TOAST', toast: t('2') } as never)
    expect((s as { toasts: Array<{ id: string }> }).toasts.map((x) => x.id)[0]).toBe('2')
    expect((s as { toasts: unknown[] }).toasts.length).toBeLessThanOrEqual(5)
  })

  it('UPDATE_TOAST modifica solo el indicado', () => {
    const s0 = { toasts: [t('1', { title: 'a' }), t('2', { title: 'b' })] }
    const s = reducer(s0 as never, { type: 'UPDATE_TOAST', toast: { id: '1', title: 'nuevo' } } as never) as { toasts: Array<{ id: string; title: string }> }
    expect(s.toasts.find((x) => x.id === '1')?.title).toBe('nuevo')
    expect(s.toasts.find((x) => x.id === '2')?.title).toBe('b')
  })

  it('DISMISS_TOAST cierra uno (o todos si no se indica id) y REMOVE_TOAST lo quita', () => {
    const s0 = { toasts: [t('1'), t('2')] }
    const one = reducer(s0 as never, { type: 'DISMISS_TOAST', toastId: '1' } as never) as { toasts: Array<{ id: string; open: boolean }> }
    expect(one.toasts.find((x) => x.id === '1')?.open).toBe(false)
    expect(one.toasts.find((x) => x.id === '2')?.open).toBe(true)
    const all = reducer(s0 as never, { type: 'DISMISS_TOAST' } as never) as { toasts: Array<{ open: boolean }> }
    expect(all.toasts.every((x) => x.open === false)).toBe(true)
    const removed = reducer(s0 as never, { type: 'REMOVE_TOAST', toastId: '1' } as never) as { toasts: Array<{ id: string }> }
    expect(removed.toasts.map((x) => x.id)).toEqual(['2'])
    expect((reducer(s0 as never, { type: 'REMOVE_TOAST' } as never) as { toasts: unknown[] }).toasts).toEqual([])
  })
})
