// @vitest-environment jsdom
/**
 * Sección «Configuración general» de la organización: sus estados (cargando, error con reintento, solo lectura para un
 * colaborador) y que guardar dispara la mutación con el documento editado. Los hooks de tRPC se simulan.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const day = (open: boolean) => ({ open, from: '09:00', to: '17:00' })
const data = (canEdit: boolean) => ({
  canEdit,
  updatedAt: null,
  general: {
    timezone: 'America/Argentina/Buenos_Aires', defaultLocale: 'es' as const,
    contact: { publicEmail: '', emergencyPhone: '' },
    hours: { mode: 'schedule' as const, note: '', weekly: { mon: day(true), tue: day(true), wed: day(true), thu: day(true), fri: day(true), sat: day(false), sun: day(false) } },
    assistant: { enabled: true, name: 'Asistente', welcomeMessage: 'Hola', outOfHoursMessage: 'Fuera', fallbackMessage: 'No sé', disclaimer: 'Auto', answerOnlyFromContent: true, handoffEmail: '' },
  },
  storefront: {
    brand: { publicName: '', tagline: '' }, seo: { title: '', description: '' },
    social: { instagram: '', facebook: '', x: '', youtube: '', linkedin: '', tiktok: '' },
    legal: { termsUrl: '', privacyUrl: '', returnsUrl: '' },
    announcement: { enabled: false, text: '', linkUrl: '', linkLabel: '' },
    display: { showEmail: true, showEmergencyPhone: true, showHours: true },
    webChat: { enabled: false, position: 'right' as const, greeting: '', allowedOrigins: [] as string[] },
  },
})

const state = {
  query: { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() },
  general: { mutate: vi.fn(), isPending: false, error: null as unknown },
  storefront: { mutate: vi.fn(), isPending: false, error: null as unknown },
}

vi.mock('@/hooks/use-config', () => ({
  useOrgSettings: () => state.query,
  useUpdateGeneralSettings: () => state.general,
  useUpdateStorefrontSettings: () => state.storefront,
}))

import { SettingsSection } from './settings-section'

beforeAll(() => {
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
beforeEach(() => {
  state.query = { data: undefined, isLoading: false, error: null, refetch: vi.fn() }
  state.general = { mutate: vi.fn(), isPending: false, error: null }
  state.storefront = { mutate: vi.fn(), isPending: false, error: null }
})
afterEach(cleanup)

describe('SettingsSection', () => {
  it('cargando: no muestra formularios', () => {
    state.query.isLoading = true
    render(<SettingsSection />)
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
  })

  it('error: muestra el mensaje y «Reintentar» vuelve a consultar', () => {
    state.query.error = new Error('sin conexión')
    render(<SettingsSection />)
    expect(screen.getByText('No se pudo cargar la configuración general.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(state.query.refetch).toHaveBeenCalledTimes(1)
  })

  it('dueño: edita y guarda; la mutación recibe el documento completo editado', () => {
    state.query.data = data(true)
    render(<SettingsSection />)
    fireEvent.change(screen.getByLabelText('Nombre del asistente'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(state.general.mutate).toHaveBeenCalledTimes(1)
    const sent = state.general.mutate.mock.calls[0]![0] as ReturnType<typeof data>['general']
    expect(sent.assistant.name).toBe('Ana')
    expect(sent.timezone).toBe('America/Argentina/Buenos_Aires')
  })

  it('colaborador (canEdit=false): solo lectura, sin botón de guardar', () => {
    state.query.data = data(false)
    render(<SettingsSection />)
    expect((screen.getByLabelText('Nombre del asistente') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
    expect(screen.getByText(/Solo el dueño/)).toBeTruthy()
  })

  it('muestra el error del servidor al guardar', () => {
    state.query.data = data(true)
    state.general.error = new Error('Correo inválido')
    render(<SettingsSection />)
    expect(screen.getByRole('alert').textContent).toContain('Correo inválido')
  })
})
