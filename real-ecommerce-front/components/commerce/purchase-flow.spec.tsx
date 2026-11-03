// @vitest-environment jsdom
/**
 * Camino de compra del storefront: agregar a la bolsa, finalizar la compra y ver los pedidos. Es lo que, si se rompe, el
 * negocio deja de vender. Se simula el contexto de la tienda, la bolsa y tRPC; se prueba lo que el cliente ve y dispara.
 */
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDictionary } from '@/lib/i18n'

const dict = getDictionary('es')

const commerce = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))
const bag = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))
const trpcState = vi.hoisted(() => ({
  checkout: { mutateAsync: vi.fn(), isPending: false },
  orders: { data: undefined as unknown, isLoading: false, error: null as unknown },
  invalidate: vi.fn(),
}))

vi.mock('@/components/commerce/commerce-provider', () => ({ useCommerce: () => commerce.value }))
vi.mock('@/components/commerce/use-bag', () => ({ useBag: () => bag.value }))
vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: () => ({ customer: { orders: { invalidate: trpcState.invalidate } } }),
    customer: {
      checkout: { useMutation: () => trpcState.checkout },
      orders: { useQuery: () => trpcState.orders },
    },
  },
}))

import { AddToCart } from './add-to-cart'
import { CheckoutView } from './checkout-view'
import { OrdersView } from './orders-view'

const base = () => ({
  dict, locale: 'es', basePath: '/es/mi-tienda', intlTag: 'es-AR', storeName: 'Mi Tienda',
  customer: { uid: 'u', email: 'ana@x.com', name: 'Ana', photoUrl: null }, ready: true, cartId: 'cart-1',
  setCartId: vi.fn(), openAuth: vi.fn(), setPanel: vi.fn(),
})
const line = (over: Record<string, unknown> = {}) => ({
  variantId: 'v1', quantity: 2, variant: { id: 'v1', title: 'Único', priceCents: 150000, currency: 'ARS', product: { name: 'Zapatilla' }, inventory: null }, ...over,
})
const bagWith = (lines: unknown[]) => ({
  lines, isLoading: false, mixedCurrency: false, summary: { subtotalCents: 300000, currency: 'ARS', itemCount: 2 },
  addItem: vi.fn().mockResolvedValue({}), removeItem: vi.fn(), isAdding: false,
})

beforeEach(() => {
  commerce.value = base()
  bag.value = bagWith([line()])
  trpcState.checkout = { mutateAsync: vi.fn(), isPending: false }
  trpcState.orders = { data: undefined, isLoading: false, error: null }
  trpcState.invalidate = vi.fn()
})
afterEach(cleanup)

const variant = (over: Record<string, unknown> = {}) => ({ id: 'v1', title: 'Único', priceCents: 150000, available: true, ...over })

describe('AddToCart', () => {
  it('una sola variante disponible queda elegida y muestra el precio total', () => {
    render(<AddToCart variants={[variant()]} currency="ARS" />)
    const button = screen.getByRole('button', { name: /Agregar a la bolsa/ })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(button.textContent).toMatch(/1\.500/)
  })

  it('sin variantes o todas sin stock muestra «Sin stock» y ningún botón de agregar', () => {
    const { rerender } = render(<AddToCart variants={[]} currency="ARS" />)
    expect(screen.getByText('Sin stock')).toBeTruthy()
    rerender(<AddToCart variants={[variant({ available: false })]} currency="ARS" />)
    expect(screen.getByText('Sin stock')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Agregar/ })).toBeNull()
  })

  it('con varias variantes hay que elegir una; las agotadas no se pueden elegir', () => {
    render(<AddToCart variants={[variant({ id: 'a', title: 'Talle 40' }), variant({ id: 'b', title: 'Talle 41', available: false })]} currency="ARS" />)
    const add = screen.getByRole('button', { name: dict.commerce.chooseVariant }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    expect((screen.getByRole('radio', { name: /Talle 41/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Talle 40' }))
    expect((screen.getByRole('button', { name: /Agregar a la bolsa/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('con sesión agrega la cantidad elegida y avisa; «Ver bolsa» abre el panel', async () => {
    render(<AddToCart variants={[variant()]} currency="ARS" />)
    fireEvent.click(screen.getByRole('button', { name: '+' })) // sube la cantidad a 2
    fireEvent.click(screen.getByRole('button', { name: /Agregar a la bolsa/ }))
    await waitFor(() => expect((bag.value as ReturnType<typeof bagWith>).addItem).toHaveBeenCalledWith('v1', 2))
    expect(await screen.findByText(dict.commerce.added, { exact: false })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: dict.commerce.viewBag }))
    expect(commerce.value['setPanel']).toHaveBeenCalledWith(true)
  })

  it('SIN sesión abre el ingreso y NO agrega; al ingresar completa la compra pendiente', async () => {
    commerce.value = { ...base(), customer: null }
    const view = render(<AddToCart variants={[variant()]} currency="ARS" />)
    fireEvent.click(screen.getByRole('button', { name: /Agregar a la bolsa/ }))
    expect(commerce.value['openAuth']).toHaveBeenCalledTimes(1)
    expect((bag.value as ReturnType<typeof bagWith>).addItem).not.toHaveBeenCalled()

    commerce.value = base() // el cliente terminó de ingresar
    view.rerender(<AddToCart variants={[variant()]} currency="ARS" />)
    await waitFor(() => expect((bag.value as ReturnType<typeof bagWith>).addItem).toHaveBeenCalledWith('v1', 1))
  })

  it('si el back falla muestra el error genérico', async () => {
    ;(bag.value as ReturnType<typeof bagWith>).addItem = vi.fn().mockRejectedValue(new Error('x'))
    render(<AddToCart variants={[variant()]} currency="ARS" />)
    fireEvent.click(screen.getByRole('button', { name: /Agregar a la bolsa/ }))
    expect((await screen.findByRole('alert')).textContent).toBe(dict.commerce.genericError)
  })

  it('mientras agrega, el botón se deshabilita y dice «Agregando…»', () => {
    ;(bag.value as ReturnType<typeof bagWith>).isAdding = true
    render(<AddToCart variants={[variant()]} currency="ARS" />)
    const button = screen.getByRole('button', { name: dict.commerce.adding }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})

describe('CheckoutView', () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText(dict.commerce.street), { target: { value: ' Av. Siempreviva 742 ' } })
    fireEvent.change(screen.getByLabelText(dict.commerce.city), { target: { value: 'Rosario' } })
    fireEvent.change(screen.getByLabelText(dict.commerce.postalCode), { target: { value: '2000' } })
  }

  it('mientras Firebase no respondió muestra «cargando»', () => {
    commerce.value = { ...base(), ready: false }
    render(<CheckoutView defaultCountry="AR" />)
    expect(screen.getByText(dict.commerce.loading)).toBeTruthy()
  })

  it('sin sesión pide ingresar (no muestra el formulario)', () => {
    commerce.value = { ...base(), customer: null }
    render(<CheckoutView defaultCountry="AR" />)
    expect(screen.getByText(dict.commerce.needSignIn)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: dict.commerce.signIn }))
    expect(commerce.value['openAuth']).toHaveBeenCalled()
    expect(screen.queryByLabelText(dict.commerce.street)).toBeNull()
  })

  it('con la bolsa vacía no ofrece pagar, ofrece volver a la tienda', () => {
    bag.value = bagWith([])
    render(<CheckoutView defaultCountry="AR" />)
    expect(screen.getByText(dict.store.bagEmpty)).toBeTruthy()
    expect(screen.queryByRole('button', { name: new RegExp(dict.commerce.placeOrder) })).toBeNull()
    expect(screen.getByRole('link', { name: dict.commerce.backToStore }).getAttribute('href')).toBe('/es/mi-tienda/productos')
  })

  it('el país arranca con el de la tienda y se muestra el resumen con el subtotal', () => {
    render(<CheckoutView defaultCountry="AR" />)
    expect((screen.getByLabelText(dict.commerce.country) as HTMLInputElement).value).toBe('AR')
    expect(screen.getByText('Zapatilla')).toBeTruthy()
    expect(screen.getByRole('button', { name: new RegExp(dict.commerce.placeOrder) }).textContent).toMatch(/3\.000/)
  })

  it('confirma el pedido con la dirección limpia (recortada, país en mayúsculas), vacía el carrito y muestra el número', async () => {
    trpcState.checkout.mutateAsync = vi.fn().mockResolvedValue({ id: 'abcdef12-0000', totalCents: 300000, currency: 'ARS' })
    render(<CheckoutView defaultCountry="ar" />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(dict.commerce.placeOrder) }))

    await waitFor(() => expect(trpcState.checkout.mutateAsync).toHaveBeenCalled())
    expect(trpcState.checkout.mutateAsync).toHaveBeenCalledWith({
      cartId: 'cart-1', locale: 'es',
      shippingAddress: { street: 'Av. Siempreviva 742', city: 'Rosario', postalCode: '2000', country: 'AR' }, // sin `state` vacío
    })
    expect(await screen.findByText(dict.commerce.orderPlacedTitle)).toBeTruthy()
    expect(screen.getByText('#abcdef12')).toBeTruthy()
    expect(commerce.value['setCartId']).toHaveBeenCalledWith(null)
    expect(trpcState.invalidate).toHaveBeenCalled() // «Mis pedidos» se refresca
    expect(screen.getByRole('link', { name: dict.commerce.myOrders }).getAttribute('href')).toBe('/es/mi-tienda/pedidos')
  })

  it('incluye la provincia solo si se completó', async () => {
    trpcState.checkout.mutateAsync = vi.fn().mockResolvedValue({ id: 'x'.repeat(10), totalCents: 1, currency: 'ARS' })
    render(<CheckoutView defaultCountry="AR" />)
    fill()
    fireEvent.change(screen.getByLabelText(dict.commerce.state), { target: { value: 'Santa Fe' } })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(dict.commerce.placeOrder) }))
    await waitFor(() => expect(trpcState.checkout.mutateAsync).toHaveBeenCalled())
    expect(trpcState.checkout.mutateAsync.mock.calls[0]![0].shippingAddress.state).toBe('Santa Fe')
  })

  it('si el back falla muestra su mensaje, NO vacía el carrito y deja reintentar', async () => {
    trpcState.checkout.mutateAsync = vi.fn().mockRejectedValue(new Error('Sin stock suficiente para SKU-1'))
    render(<CheckoutView defaultCountry="AR" />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(dict.commerce.placeOrder) }))
    expect((await screen.findByRole('alert')).textContent).toContain('Sin stock suficiente')
    expect(commerce.value['setCartId']).not.toHaveBeenCalled()
    expect(screen.getByLabelText(dict.commerce.street)).toBeTruthy() // el formulario sigue ahí
  })

  it.each(['[{"code":"too_small"}]', '{"zod":"error"}'])('un error técnico (%s) se reemplaza por un texto legible', async (technical) => {
    trpcState.checkout.mutateAsync = vi.fn().mockRejectedValue(new Error(technical))
    render(<CheckoutView defaultCountry="AR" />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(dict.commerce.placeOrder) }))
    expect((await screen.findByRole('alert')).textContent).toBe(dict.commerce.genericError)
  })

  it('con monedas mezcladas no se puede confirmar', () => {
    ;(bag.value as ReturnType<typeof bagWith>).mixedCurrency = true
    render(<CheckoutView defaultCountry="AR" />)
    expect((screen.getByRole('button', { name: new RegExp(dict.commerce.placeOrder) }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sin carrito (cartId nulo) el envío no hace nada', () => {
    commerce.value = { ...base(), cartId: null }
    render(<CheckoutView defaultCountry="AR" />)
    fill()
    fireEvent.submit(screen.getByLabelText(dict.commerce.street).closest('form')!)
    expect(trpcState.checkout.mutateAsync).not.toHaveBeenCalled()
  })
})

describe('OrdersView', () => {
  const order = (over: Record<string, unknown> = {}) => ({
    id: 'abcdef12-3456', status: 'PENDING_PAYMENT', totalCents: 300000, currency: 'ARS', createdAt: '2026-10-01T10:00:00.000Z',
    shippingAddress: { street: 'Calle 1', city: 'Rosario', country: 'AR' }, items: [], ...over,
  })

  it('sin sesión pide ingresar; sin Firebase listo muestra cargando', () => {
    commerce.value = { ...base(), ready: false }
    const view = render(<OrdersView />)
    expect(screen.getByText(dict.commerce.loading)).toBeTruthy()
    commerce.value = { ...base(), customer: null }
    view.rerender(<OrdersView />)
    expect(screen.getByText(dict.commerce.needSignIn)).toBeTruthy()
  })

  it('lista vacía, cargando y error tienen su estado', () => {
    trpcState.orders = { data: [], isLoading: false, error: null }
    const view = render(<OrdersView />)
    expect(screen.getByText(dict.commerce.ordersEmpty)).toBeTruthy()
    trpcState.orders = { data: undefined, isLoading: true, error: null }
    view.rerender(<OrdersView />)
    expect(screen.getByText(dict.commerce.loading)).toBeTruthy()
    trpcState.orders = { data: undefined, isLoading: false, error: new Error('x') }
    view.rerender(<OrdersView />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('muestra número, estado traducido, total y dirección de cada pedido', () => {
    trpcState.orders = { data: [order(), order({ id: 'zzzzzzzz-1', status: 'SHIPPED' })], isLoading: false, error: null }
    render(<OrdersView />)
    expect(screen.getByText('#abcdef12')).toBeTruthy()
    expect(screen.getByText(dict.commerce.status.PENDING_PAYMENT)).toBeTruthy()
    expect(screen.getByText(dict.commerce.status.SHIPPED)).toBeTruthy()
    expect(screen.getAllByText(/3\.000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Calle 1, Rosario, AR/).length).toBeGreaterThan(0)
  })

  it('un estado desconocido se muestra tal cual (no rompe la pantalla)', () => {
    trpcState.orders = { data: [order({ status: 'ESTADO_NUEVO' })], isLoading: false, error: null }
    render(<OrdersView />)
    expect(screen.getByText('ESTADO_NUEVO')).toBeTruthy()
  })
})
