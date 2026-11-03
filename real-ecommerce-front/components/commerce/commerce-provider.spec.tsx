// @vitest-environment jsdom
/**
 * CommerceProvider: la sesión del cliente de la tienda (ADR-021). Lo que importa y se verifica:
 *   · un invitado (sin email) NO cuenta como cliente
 *   · el carrito y la sesión se guardan POR ORGANIZACIÓN (otra tienda no ve el carrito de esta)
 *   · cerrar sesión borra el carrito local y vacía la caché (nada del cliente anterior queda en memoria)
 *   · cerrar la ventana de Google no es un error; cualquier otro fallo sí se avisa
 */
import * as React from 'react'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fb = vi.hoisted(() => ({
  watch: null as null | ((u: unknown) => void),
  unsubscribe: vi.fn(),
  configured: true,
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/commerce/firebase', () => ({
  watchCustomer: (cb: (u: unknown) => void) => { fb.watch = cb; return fb.unsubscribe },
  currentIdToken: vi.fn(),
  isFirebaseConfigured: () => fb.configured,
  signInWithGoogle: () => fb.signIn(),
  signOutCustomer: () => fb.signOut(),
}))
vi.mock('@/lib/trpc/client', () => ({
  trpc: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> },
  createStoreTrpcClient: vi.fn(() => ({})),
}))

import { CommerceProvider, useCommerce } from './commerce-provider'

const wrapper = (org = 'org-1') =>
  function W({ children }: { children: React.ReactNode }) {
    return <CommerceProvider organizationId={org} storeName="Mi Tienda" countryCode="AR" slug="mi-tienda" locale="es">{children}</CommerceProvider>
  }
const setup = (org = 'org-1') => renderHook(() => useCommerce(), { wrapper: wrapper(org) })
const user = (over: Record<string, unknown> = {}) => ({ uid: 'u1', email: 'ana@x.com', displayName: 'Ana', photoURL: null, ...over })

beforeEach(() => {
  fb.watch = null
  fb.configured = true
  fb.signIn = vi.fn().mockResolvedValue(undefined)
  fb.signOut = vi.fn().mockResolvedValue(undefined)
  fb.unsubscribe.mockClear()
  window.localStorage.clear()
})
afterEach(cleanup)

describe('useCommerce', () => {
  it('fuera del provider falla con un mensaje claro', () => {
    expect(() => renderHook(() => useCommerce())).toThrow(/dentro de <CommerceProvider>/)
  })

  it('expone organización, tienda, idioma, diccionario y rutas base', () => {
    const { result } = setup()
    expect(result.current).toMatchObject({ organizationId: 'org-1', storeName: 'Mi Tienda', locale: 'es', basePath: '/es/mi-tienda' })
    expect(result.current.dict.commerce.signIn).toBe('Ingresar')
    expect(result.current.intlTag).toMatch(/^es/)
  })
})

describe('cliente (sesión de Firebase)', () => {
  it('antes de que Firebase responda no está listo; después sí', () => {
    const { result } = setup()
    expect(result.current.ready).toBe(false)
    act(() => fb.watch!(null))
    expect(result.current).toMatchObject({ ready: true, customer: null })
  })

  it('un usuario con email es el cliente; uno SIN email (invitado) no', () => {
    const { result } = setup()
    act(() => fb.watch!(user({ photoURL: 'http://f/x.png' })))
    expect(result.current.customer).toEqual({ uid: 'u1', email: 'ana@x.com', name: 'Ana', photoUrl: 'http://f/x.png' })
    act(() => fb.watch!(user({ email: null })))
    expect(result.current.customer).toBeNull()
  })

  it('al desmontar deja de observar la sesión', () => {
    const { unmount } = setup()
    unmount()
    expect(fb.unsubscribe).toHaveBeenCalled()
  })

  it('authUnavailable refleja si Firebase está configurado', () => {
    fb.configured = false
    expect(setup().result.current.authUnavailable).toBe(true)
    fb.configured = true
    expect(setup().result.current.authUnavailable).toBe(false)
  })
})

describe('sesión y carrito locales (por organización)', () => {
  it('crea un sessionId, lo guarda y lo reutiliza al volver', async () => {
    const first = setup()
    await waitFor(() => expect(first.result.current.sessionId).not.toBe(''))
    const sid = first.result.current.sessionId
    expect(window.localStorage.getItem('store:org-1:sessionId')).toBe(sid)
    first.unmount()
    const second = setup()
    await waitFor(() => expect(second.result.current.sessionId).toBe(sid))
  })

  it('cada organización tiene su propia sesión y su propio carrito', async () => {
    const a = setup('org-A')
    await waitFor(() => expect(a.result.current.sessionId).not.toBe(''))
    act(() => a.result.current.setCartId('cart-A'))
    const b = setup('org-B')
    await waitFor(() => expect(b.result.current.sessionId).not.toBe(''))
    expect(b.result.current.sessionId).not.toBe(a.result.current.sessionId)
    expect(b.result.current.cartId).toBeNull() // el carrito de A no se ve en B
    expect(window.localStorage.getItem('store:org-A:cartId')).toBe('cart-A')
    expect(window.localStorage.getItem('store:org-B:cartId')).toBeNull()
  })

  it('el carrito guardado se restaura y setCartId(null) lo borra', async () => {
    window.localStorage.setItem('store:org-1:cartId', 'cart-9')
    const { result } = setup()
    await waitFor(() => expect(result.current.cartId).toBe('cart-9'))
    act(() => result.current.setCartId(null))
    expect(result.current.cartId).toBeNull()
    expect(window.localStorage.getItem('store:org-1:cartId')).toBeNull()
  })

  it('si el almacenamiento está bloqueado, sigue funcionando en memoria', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = setup()
    await waitFor(() => expect(result.current.sessionId).not.toBe(''))
    expect(() => act(() => result.current.setCartId('c'))).not.toThrow()
    expect(result.current.cartId).toBe('c')
    vi.restoreAllMocks()
  })
})

describe('ingresar y salir', () => {
  it('signIn con Google cierra el diálogo y refresca los datos', async () => {
    const { result } = setup()
    act(() => result.current.openAuth())
    expect(result.current.authOpen).toBe(true)
    await act(async () => { await result.current.signIn() })
    expect(fb.signIn).toHaveBeenCalledTimes(1)
    expect(result.current.authOpen).toBe(false)
    expect(result.current.authError).toBe(false)
  })

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])('cerrar la ventana (%s) NO es un error', async (code) => {
    fb.signIn = vi.fn().mockRejectedValue({ code })
    const { result } = setup()
    act(() => result.current.openAuth())
    await act(async () => { await result.current.signIn() })
    expect(result.current.authError).toBe(false)
    expect(result.current.authOpen).toBe(true) // el diálogo sigue abierto para reintentar
  })

  it('cualquier otro fallo de ingreso se avisa', async () => {
    fb.signIn = vi.fn().mockRejectedValue({ code: 'auth/network-request-failed' })
    const { result } = setup()
    await act(async () => { await result.current.signIn() })
    expect(result.current.authError).toBe(true)
  })

  it('openAuth cierra el panel de cuenta y limpia el error anterior', async () => {
    fb.signIn = vi.fn().mockRejectedValue(new Error('x'))
    const { result } = setup()
    await act(async () => { await result.current.signIn() })
    act(() => result.current.setPanel(true))
    act(() => result.current.openAuth())
    expect(result.current).toMatchObject({ panel: false, authError: false, authOpen: true })
    act(() => result.current.closeAuth())
    expect(result.current.authOpen).toBe(false)
  })

  it('signOut cierra Firebase, borra el carrito local y cierra el panel', async () => {
    window.localStorage.setItem('store:org-1:cartId', 'cart-1')
    const { result } = setup()
    await waitFor(() => expect(result.current.cartId).toBe('cart-1'))
    act(() => result.current.setPanel(true))
    await act(async () => { await result.current.signOut() })
    expect(fb.signOut).toHaveBeenCalledTimes(1)
    expect(result.current.cartId).toBeNull()
    expect(result.current.panel).toBe(false)
    expect(window.localStorage.getItem('store:org-1:cartId')).toBeNull()
  })

  it('el provider renderiza a sus hijos', () => {
    render(<CommerceProvider organizationId="o" storeName="T" countryCode="AR" slug="t" locale="es"><p>hijo</p></CommerceProvider>)
    expect(screen.getByText('hijo')).toBeTruthy()
  })
})
