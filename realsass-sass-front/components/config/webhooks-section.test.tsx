// @vitest-environment jsdom
/**
 * Sección de webhooks: crear/rotar/borrar pasan por step-up, el secreto de firma se muestra UNA vez y la lista nunca lo
 * contiene, borrar pide confirmación y los fallos se anuncian.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mutation = (value: unknown = {}) => ({ mutateAsync: vi.fn().mockResolvedValue(value), isPending: false })
const state = {
  list: { data: [] as unknown[] | undefined, isLoading: false, error: null as unknown },
  logs: { data: [] as unknown[] | undefined, isLoading: false, error: null as unknown, refetch: vi.fn(), isFetching: false },
  create: mutation({ secret: 'whsec_SECRETO_COMPLETO' }),
  remove: mutation(),
  rotate: mutation({ secret: 'whsec_NUEVO_SECRETO' }),
  test: mutation(),
  stepUp: vi.fn(async (action: () => Promise<unknown>) => action()),
}

vi.mock('@/hooks/use-config', () => ({
  useWebhooks: () => state.list,
  useCreateWebhook: () => state.create,
  useDeleteWebhook: () => state.remove,
  useRotateWebhookSecret: () => state.rotate,
  useTestWebhook: () => state.test,
  useWebhookLogs: () => state.logs,
}))
vi.mock('@/hooks/use-step-up', () => ({ useStepUp: () => state.stepUp }))

import { WebhooksSection } from './webhooks-section'

const webhook = (over: Record<string, unknown> = {}) => ({
  id: 'w1', url: 'https://mi-sistema.com/hook', events: ['config.changed'], secretHint: 'wxyz', description: 'Prod',
  lastTriggeredAt: null, failureCount: 0, ...over,
})

beforeEach(() => {
  state.list = { data: [], isLoading: false, error: null }
  state.logs = { data: [], isLoading: false, error: null, refetch: vi.fn(), isFetching: false }
  state.create = mutation({ secret: 'whsec_SECRETO_COMPLETO' })
  state.remove = mutation()
  state.rotate = mutation({ secret: 'whsec_NUEVO_SECRETO' })
  state.test = mutation()
  state.stepUp = vi.fn(async (action: () => Promise<unknown>) => action())
})
afterEach(cleanup)

describe('WebhooksSection: lista', () => {
  it('estados: error y vacío', () => {
    state.list = { data: undefined, isLoading: false, error: new Error('sin conexión') }
    const first = render(<WebhooksSection />)
    expect(screen.getByRole('alert').textContent).toContain('sin conexión')
    first.unmount()
    state.list = { data: [], isLoading: false, error: null }
    render(<WebhooksSection />)
    expect(screen.getByText('Sin webhooks')).toBeTruthy()
  })

  it('muestra URL, eventos y la pista de firma (nunca el secreto)', () => {
    state.list = { data: [webhook()], isLoading: false, error: null }
    render(<WebhooksSection />)
    expect(screen.getByText('https://mi-sistema.com/hook')).toBeTruthy()
    expect(screen.getByText('config.changed')).toBeTruthy()
    expect(screen.getByText(/whsec_••••wxyz/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('SECRETO')
  })

  it('avisa si no tiene clave de firma y cuenta las entregas fallidas seguidas', () => {
    state.list = { data: [webhook({ secretHint: '', failureCount: 3 })], isLoading: false, error: null }
    render(<WebhooksSection />)
    expect(screen.getByText(/Sin clave de firma/)).toBeTruthy()
    expect(screen.getByText(/3 entregas fallidas seguidas/)).toBeTruthy()
  })
})

describe('WebhooksSection: crear', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: /Agregar/ }))

  it('crea por step-up con la lista de eventos limpia y muestra el secreto UNA vez', async () => {
    render(<WebhooksSection />)
    open()
    fireEvent.change(screen.getByPlaceholderText('https://tu-sistema.com/webhooks'), { target: { value: ' https://nuevo.com/h ' } })
    fireEvent.change(screen.getByPlaceholderText(/Eventos separados por coma/), { target: { value: 'a, b ,, c' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => expect(state.create.mutateAsync).toHaveBeenCalled())
    expect(state.stepUp).toHaveBeenCalledTimes(1)
    expect(state.create.mutateAsync).toHaveBeenCalledWith({ url: 'https://nuevo.com/h', events: ['a', 'b', 'c'] })
    const reveal = await screen.findByLabelText('Valor del secreto')
    expect((reveal as HTMLInputElement).value).toBe('whsec_SECRETO_COMPLETO')
    expect(screen.getByText(/no vas a poder verla de nuevo/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ya la guardé' }))
    await waitFor(() => expect(screen.queryByLabelText('Valor del secreto')).toBeNull())
    expect(document.body.textContent).not.toContain('whsec_SECRETO_COMPLETO') // ya no está en pantalla
  })

  it('si el back rechaza la URL (p. ej. interna) muestra el error y no revela ningún secreto', async () => {
    state.stepUp = vi.fn().mockRejectedValue(new Error('La URL apunta a una dirección privada o interna'))
    render(<WebhooksSection />)
    open()
    fireEvent.change(screen.getByPlaceholderText('https://tu-sistema.com/webhooks'), { target: { value: 'https://10.0.0.1/x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect((await screen.findByRole('alert')).textContent).toContain('dirección privada')
    expect(screen.queryByLabelText('Valor del secreto')).toBeNull()
  })

  it('«Crear» está deshabilitado sin URL', () => {
    render(<WebhooksSection />)
    open()
    expect((screen.getByRole('button', { name: 'Crear' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('WebhooksSection: acciones sobre un webhook', () => {
  beforeEach(() => { state.list = { data: [webhook()], isLoading: false, error: null } })

  it('rotar pide step-up y muestra el NUEVO secreto', async () => {
    render(<WebhooksSection />)
    fireEvent.click(screen.getByRole('button', { name: /Rotar/ }))
    await waitFor(() => expect(state.rotate.mutateAsync).toHaveBeenCalledWith({ webhookId: 'w1' }))
    expect(state.stepUp).toHaveBeenCalledTimes(1)
    expect(((await screen.findByLabelText('Valor del secreto')) as HTMLInputElement).value).toBe('whsec_NUEVO_SECRETO')
  })

  it('eliminar exige confirmar: el primer clic no borra', async () => {
    render(<WebhooksSection />)
    fireEvent.click(screen.getByRole('button', { name: /Eliminar/ }))
    expect(state.remove.mutateAsync).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(state.remove.mutateAsync).toHaveBeenCalledWith({ webhookId: 'w1' }))
    expect(state.stepUp).toHaveBeenCalledTimes(1)
    expect((await screen.findByRole('status')).textContent).toContain('eliminado')
  })

  it('el evento de prueba NO pide step-up y abre las últimas entregas', async () => {
    state.logs = {
      data: [{ id: 'l1', event: 'test', statusCode: 500, success: false, duration: 120, attempt: 2, error: 'HTTP 500', createdAt: new Date().toISOString() }],
      isLoading: false, error: null, refetch: vi.fn(), isFetching: false,
    }
    render(<WebhooksSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar evento de prueba' }))
    await waitFor(() => expect(state.test.mutateAsync).toHaveBeenCalledWith({ webhookId: 'w1' }))
    expect(state.stepUp).not.toHaveBeenCalled()
    expect(await screen.findByText('Últimas entregas')).toBeTruthy()
    expect(screen.getByText('Falló')).toBeTruthy()
    expect(screen.getByText('HTTP 500')).toBeTruthy()
  })
})
