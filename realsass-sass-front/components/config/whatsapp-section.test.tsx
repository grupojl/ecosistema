// @vitest-environment jsdom
/**
 * DT-WA-07: la sección de WhatsApp (ADR-025) en sus estados: cargando, error con reintento, conectado, con error de
 * Meta, sin conexión (configurada y sin configurar) y fallo de la acción. Los hooks de tRPC se simulan: se prueba
 * lo que el dueño ve y lo que dispara.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const state = {
  query: { data: null as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  connect: { start: vi.fn(), isPending: false, error: null as unknown },
  disconnect: { start: vi.fn(), isPending: false, error: null as unknown },
  configured: true,
}

vi.mock('@/features/whatsapp', () => ({
  useWhatsappConnection: () => state.query,
  useConnectWhatsapp: () => state.connect,
  useDisconnectWhatsapp: () => state.disconnect,
}))
vi.mock('@/features/whatsapp/embedded-signup', () => ({
  getEmbeddedSignupConfig: () => (state.configured ? { appId: 'a', configId: 'c' } : null),
}))

import { WhatsappSection } from './whatsapp-section'

beforeEach(() => {
  state.query = { data: null, isLoading: false, error: null, refetch: vi.fn() }
  state.connect = { start: vi.fn(), isPending: false, error: null }
  state.disconnect = { start: vi.fn(), isPending: false, error: null }
  state.configured = true
})
afterEach(cleanup)

const connection = (over: Record<string, unknown> = {}) => ({
  accountId: 'acc-1', displayPhone: '+54 9 11 5555-5555', status: 'CONNECTED', errorMessage: null, ...over,
})

describe('WhatsappSection', () => {
  it('cargando: muestra un esqueleto y ningún botón', () => {
    state.query.isLoading = true
    render(<WhatsappSection />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('error al cargar: muestra el mensaje y «Reintentar» vuelve a consultar', () => {
    state.query.error = new Error('chatia no responde')
    render(<WhatsappSection />)
    expect(screen.getByRole('alert').textContent).toContain('chatia no responde')
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(state.query.refetch).toHaveBeenCalledTimes(1)
  })

  it('conectado: muestra número y estado, y «Desconectar» pide desconectar ESA cuenta', () => {
    state.query.data = connection()
    render(<WhatsappSection />)
    expect(screen.getByText('+54 9 11 5555-5555')).toBeTruthy()
    expect(screen.getByText('Conectado')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }))
    expect(state.disconnect.start).toHaveBeenCalledWith('acc-1')
  })

  it('con error de Meta: muestra el motivo', () => {
    state.query.data = connection({ status: 'ERROR', errorMessage: 'Token vencido', displayPhone: null })
    render(<WhatsappSection />)
    expect(screen.getByText('Con error')).toBeTruthy()
    expect(screen.getByText('Token vencido')).toBeTruthy()
    expect(screen.getByText('Número sin identificar')).toBeTruthy()
  })

  it('sin conexión y con la app de Meta configurada: «Conectar» inicia el flujo', () => {
    render(<WhatsappSection />)
    const button = screen.getByRole('button', { name: 'Conectar WhatsApp' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(state.connect.start).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Falta configurar la app de Meta/)).toBeNull()
  })

  it('sin la app de Meta configurada: el botón está deshabilitado y explica por qué', () => {
    state.configured = false
    render(<WhatsappSection />)
    expect((screen.getByRole('button', { name: 'Conectar WhatsApp' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/NEXT_PUBLIC_META_APP_ID/)).toBeTruthy()
  })

  it('mientras conecta el botón se deshabilita (sin doble envío)', () => {
    state.connect.isPending = true
    render(<WhatsappSection />)
    expect((screen.getByRole('button', { name: /Conectar WhatsApp/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('si falla conectar o desconectar, anuncia el error (role=alert)', () => {
    state.connect.error = new Error('Faltó confirmar tu identidad')
    render(<WhatsappSection />)
    expect(screen.getByRole('alert').textContent).toContain('Faltó confirmar tu identidad')
  })
})
