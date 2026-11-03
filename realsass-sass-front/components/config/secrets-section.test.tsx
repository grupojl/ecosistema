// @vitest-environment jsdom
/**
 * La sección de claves es la pantalla más sensible del panel. Invariantes (domain/flows/owner-organizacion.md):
 *   · el valor NUNCA vuelve del servidor: la lista solo muestra nombre y pista (últimos 4)
 *   · crear / rotar / revocar pasan por step-up
 *   · ante un error, el valor sensible se borra de la memoria del formulario
 *   · revocar pide confirmación explícita
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mutation = () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })
const state = {
  list: { data: [] as unknown[] | undefined, isLoading: false, error: null as unknown },
  create: mutation(),
  rotate: mutation(),
  revoke: mutation(),
  stepUp: vi.fn(async (action: () => Promise<unknown>) => action()),
}

vi.mock('@/hooks/use-config', () => ({
  useSecrets: () => state.list,
  useCreateSecret: () => state.create,
  useRotateSecret: () => state.rotate,
  useRevokeSecret: () => state.revoke,
}))
vi.mock('@/hooks/use-step-up', () => ({ useStepUp: () => state.stepUp }))

import { SecretsSection } from './secrets-section'

const secret = (over: Record<string, unknown> = {}) => ({
  id: 's1', key: 'STRIPE_SECRET_KEY', hint: '9abc', description: 'Pagos', systemTarget: 'payments',
  createdAt: '2026-10-01T00:00:00.000Z', rotatedAt: null, expiresAt: null, ...over,
})

beforeEach(() => {
  state.list = { data: [], isLoading: false, error: null }
  state.create = mutation()
  state.rotate = mutation()
  state.revoke = mutation()
  state.stepUp = vi.fn(async (action: () => Promise<unknown>) => action())
})
afterEach(cleanup)

const typeInto = (placeholder: string | RegExp, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })

describe('SecretsSection: lista', () => {
  it('estados: cargando, error y vacío', () => {
    state.list = { data: undefined, isLoading: true, error: null }
    const { unmount } = render(<SecretsSection />)
    unmount()
    state.list = { data: undefined, isLoading: false, error: new Error('sin conexión') }
    const second = render(<SecretsSection />)
    expect(screen.getByRole('alert').textContent).toContain('sin conexión')
    second.unmount()
    state.list = { data: [], isLoading: false, error: null }
    render(<SecretsSection />)
    expect(screen.getByText('Sin claves')).toBeTruthy()
  })

  it('muestra nombre y pista de 4 caracteres, nunca un valor', () => {
    state.list = { data: [secret()], isLoading: false, error: null }
    render(<SecretsSection />)
    expect(screen.getByText('STRIPE_SECRET_KEY')).toBeTruthy()
    expect(screen.getByText(/••••9abc/)).toBeTruthy()
    expect(screen.getByText('Pagos')).toBeTruthy()
  })

  it('una clave sin pista se muestra enmascarada y una vencida se marca', () => {
    state.list = { data: [secret({ hint: '', expiresAt: '2020-01-01T00:00:00.000Z' })], isLoading: false, error: null }
    render(<SecretsSection />)
    expect(screen.getByText(/••••••••/)).toBeTruthy()
    expect(screen.getByText(/Venció el/)).toBeTruthy()
  })
})

describe('SecretsSection: crear', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: /Nueva clave/ }))

  it('el valor se captura como contraseña (no autocompleta ni se muestra)', () => {
    render(<SecretsSection />)
    open()
    const value = screen.getByPlaceholderText('Valor') as HTMLInputElement
    expect(value.type).toBe('password')
    expect(value.autocomplete).toBe('new-password')
  })

  it('guarda a través de step-up, con el destino elegido, y limpia el formulario', async () => {
    render(<SecretsSection />)
    open()
    typeInto(/Nombre/, 'MI_CLAVE')
    typeInto('Valor', 'sk_live_super_secreto')
    fireEvent.change(screen.getByLabelText('Servicio de destino'), { target: { value: 'payments' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(state.create.mutateAsync).toHaveBeenCalled())
    expect(state.stepUp).toHaveBeenCalledTimes(1)
    expect(state.create.mutateAsync).toHaveBeenCalledWith({ key: 'MI_CLAVE', value: 'sk_live_super_secreto', systemTarget: 'payments' })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('guardada'))
    expect(screen.queryByPlaceholderText('Valor')).toBeNull() // el formulario se cierra
  })

  it('si falla, muestra el error y BORRA el valor sensible del campo', async () => {
    state.stepUp = vi.fn().mockRejectedValue(new Error('Confirmá tu identidad'))
    render(<SecretsSection />)
    open()
    typeInto(/Nombre/, 'MI_CLAVE')
    typeInto('Valor', 'sk_live_super_secreto')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Confirmá tu identidad'))
    expect((screen.getByPlaceholderText('Valor') as HTMLInputElement).value).toBe('')
    expect((screen.getByPlaceholderText(/Nombre/) as HTMLInputElement).value).toBe('MI_CLAVE')
  })

  it('«Guardar» está deshabilitado sin nombre o sin valor, y Cancelar borra el valor', () => {
    render(<SecretsSection />)
    open()
    const save = screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    typeInto(/Nombre/, 'X1')
    expect(save.disabled).toBe(true)
    typeInto('Valor', 'secreto')
    expect(save.disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    open()
    expect((screen.getByPlaceholderText('Valor') as HTMLInputElement).value).toBe('')
  })
})

describe('SecretsSection: rotar y revocar', () => {
  beforeEach(() => {
    state.list = { data: [secret()], isLoading: false, error: null }
  })

  it('rotar manda el nuevo valor por step-up y vacía el campo', async () => {
    render(<SecretsSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Rotar STRIPE_SECRET_KEY' }))
    typeInto('Nuevo valor', 'nuevo-secreto-123')
    fireEvent.click(screen.getByRole('button', { name: 'Rotar' }))
    await waitFor(() => expect(state.rotate.mutateAsync).toHaveBeenCalledWith({ secretId: 's1', value: 'nuevo-secreto-123' }))
    expect(state.stepUp).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('rotada'))
    expect(screen.queryByPlaceholderText('Nuevo valor')).toBeNull()
  })

  it('revocar exige confirmación: el primer clic NO revoca', async () => {
    render(<SecretsSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Revocar STRIPE_SECRET_KEY' }))
    expect(state.revoke.mutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText(/dejarán de funcionar/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(state.revoke.mutateAsync).toHaveBeenCalledWith({ secretId: 's1' }))
    expect(state.stepUp).toHaveBeenCalledTimes(1)
  })

  it('«No» cancela la revocación sin llamar al servidor', () => {
    render(<SecretsSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Revocar STRIPE_SECRET_KEY' }))
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(state.revoke.mutateAsync).not.toHaveBeenCalled()
    expect(screen.queryByText(/dejarán de funcionar/)).toBeNull()
  })

  it('mientras hay una operación en curso los botones de la fila se deshabilitan', () => {
    state.rotate = { mutateAsync: vi.fn(), isPending: true }
    render(<SecretsSection />)
    expect((screen.getByRole('button', { name: 'Rotar STRIPE_SECRET_KEY' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Revocar STRIPE_SECRET_KEY' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
