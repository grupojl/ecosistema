// @vitest-environment jsdom
/**
 * Formularios de configuración de la organización: se editan, se guardan completos, se pueden descartar y, para un
 * colaborador (solo lectura), no se pueden enviar. Lo que se prueba es lo que el dueño ve y dispara.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  GeneralSettingsForm, StorefrontSettingsForm,
  type GeneralSettingsValue, type StorefrontSettingsValue,
} from '../src/components/org-settings-forms'

// jsdom no trae ResizeObserver, que Radix (Switch) espera
beforeAll(() => {
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
})
afterEach(cleanup)

const day = (open: boolean) => ({ open, from: '09:00', to: '17:00' })
const general = (): GeneralSettingsValue => ({
  timezone: 'America/Argentina/Buenos_Aires',
  defaultLocale: 'es',
  contact: { publicEmail: '', emergencyPhone: '' },
  hours: { mode: 'schedule', note: '', weekly: { mon: day(true), tue: day(true), wed: day(true), thu: day(true), fri: day(true), sat: day(false), sun: day(false) } },
  assistant: {
    enabled: true, name: 'Asistente', welcomeMessage: 'Hola', outOfHoursMessage: 'Fuera de horario', fallbackMessage: 'No sé',
    disclaimer: 'Soy automático', answerOnlyFromContent: true, handoffEmail: '',
  },
})
const storefront = (): StorefrontSettingsValue => ({
  brand: { publicName: '', tagline: '' },
  seo: { title: '', description: '' },
  social: { instagram: '', facebook: '', x: '', youtube: '', linkedin: '', tiktok: '' },
  legal: { termsUrl: '', privacyUrl: '', returnsUrl: '' },
  announcement: { enabled: false, text: '', linkUrl: '', linkLabel: '' },
  display: { showEmail: true, showEmergencyPhone: true, showHours: true },
  webChat: { enabled: false, position: 'right', greeting: '', allowedOrigins: [] },
})

describe('GeneralSettingsForm', () => {
  it('sin cambios el botón Guardar está deshabilitado; al editar se habilita y envía el documento completo', async () => {
    const onSave = vi.fn()
    render(<GeneralSettingsForm value={general()} onSave={onSave} />)
    const save = screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Correo público'), { target: { value: 'info@muni.gob.ar' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const sent = onSave.mock.calls[0]![0] as GeneralSettingsValue
    expect(sent.contact.publicEmail).toBe('info@muni.gob.ar')
    expect(sent.assistant.name).toBe('Asistente') // el resto del documento viaja intacto
    expect(sent.hours.weekly.sat.open).toBe(false)
  })

  it('Descartar vuelve al valor guardado', () => {
    render(<GeneralSettingsForm value={general()} onSave={vi.fn()} />)
    const input = screen.getByLabelText('Nombre del asistente') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Ana' } })
    expect(input.value).toBe('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(input.value).toBe('Asistente')
  })

  it('«Atención 24/7» oculta la grilla semanal', () => {
    render(<GeneralSettingsForm value={general()} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Lunes: abierto')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'Atención sin horario (24/7)' }))
    expect(screen.queryByLabelText('Lunes: abierto')).toBeNull()
  })

  it('editar un día cambia solo ese día', async () => {
    const onSave = vi.fn()
    render(<GeneralSettingsForm value={general()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Lunes: desde'), { target: { value: '08:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const sent = onSave.mock.calls[0]![0] as GeneralSettingsValue
    expect(sent.hours.weekly.mon.from).toBe('08:30')
    expect(sent.hours.weekly.tue.from).toBe('09:00')
  })

  it('muestra el error del servidor y bloquea los campos mientras guarda', () => {
    render(<GeneralSettingsForm value={general()} onSave={vi.fn()} errorMessage="Correo inválido" isSaving />)
    expect(screen.getByRole('alert').textContent).toContain('Correo inválido')
    expect((screen.getByLabelText('Correo público') as HTMLInputElement).disabled).toBe(true)
  })

  it('solo lectura (colaborador): todo deshabilitado, sin botón de guardar y con la explicación', () => {
    render(<GeneralSettingsForm value={general()} onSave={vi.fn()} readOnly />)
    expect((screen.getByLabelText('Correo público') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
    expect(screen.getByText(/Solo el dueño/)).toBeTruthy()
  })

  it('si el valor guardado cambia desde afuera, el formulario lo toma', () => {
    const { rerender } = render(<GeneralSettingsForm value={general()} onSave={vi.fn()} />)
    const next = general()
    next.assistant.name = 'Lucía'
    rerender(<GeneralSettingsForm value={next} onSave={vi.fn()} />)
    expect((screen.getByLabelText('Nombre del asistente') as HTMLInputElement).value).toBe('Lucía')
  })
})

describe('StorefrontSettingsForm', () => {
  it('los sitios autorizados se escriben uno por línea (se puede teclear un salto de línea) y se envían como lista limpia', async () => {
    const onSave = vi.fn()
    render(<StorefrontSettingsForm value={storefront()} onSave={onSave} />)
    const area = screen.getByLabelText('Sitios autorizados') as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'https://www.muni.gob.ar\n' } })
    expect(area.value).toBe('https://www.muni.gob.ar\n') // el salto de línea no se pierde al tipear
    fireEvent.change(area, { target: { value: 'https://www.muni.gob.ar\n\n  https://app.muni.gob.ar  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const sent = onSave.mock.calls[0]![0] as StorefrontSettingsValue
    expect(sent.webChat.allowedOrigins).toEqual(['https://www.muni.gob.ar', 'https://app.muni.gob.ar'])
  })

  it('Descartar restaura también los sitios autorizados', () => {
    const value = storefront()
    value.webChat.allowedOrigins = ['https://www.muni.gob.ar']
    render(<StorefrontSettingsForm value={value} onSave={vi.fn()} />)
    const area = screen.getByLabelText('Sitios autorizados') as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'https://otro.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(area.value).toBe('https://www.muni.gob.ar')
  })

  it('edita redes, aviso y visibilidad de contacto', async () => {
    const onSave = vi.fn()
    render(<StorefrontSettingsForm value={storefront()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: 'https://instagram.com/muni' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar aviso' }))
    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Cerrado el lunes' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Teléfono de emergencia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const sent = onSave.mock.calls[0]![0] as StorefrontSettingsValue
    expect(sent.social.instagram).toBe('https://instagram.com/muni')
    expect(sent.announcement).toMatchObject({ enabled: true, text: 'Cerrado el lunes' })
    expect(sent.display.showEmergencyPhone).toBe(false)
    expect(sent.display.showEmail).toBe(true)
  })
})
