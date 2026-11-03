// @vitest-environment jsdom
/**
 * Regresión: el formulario «Editar organización» leía la descripción del perfil (`auth.me`), que solo trae
 * {id, name, slug}. La descripción arrancaba vacía y guardar —aunque solo se cambiara el nombre— la BORRABA.
 * (El `as any` que lo leía escondía el error de tipos.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const state = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, error: null as unknown },
  update: { mutate: vi.fn(), isPending: false, error: null as unknown },
}))

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    organizations: {
      me: { useQuery: () => state.query },
      update: { useMutation: () => state.update },
    },
  },
}))
// Lo demás que importa la página no interviene en el formulario
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({}) }))
vi.mock('@/hooks/use-auth-trpc', () => ({ useMe: () => ({}), useSelectRole: () => ({}), useRefreshClaims: () => ({}) }))
vi.mock('@/hooks/use-dashboard-sso', () => ({ useDashboardSSO: () => ({}) }))
vi.mock('@/components/collaborators-section', () => ({ CollaboratorsSection: () => null }))
vi.mock('@/components/organization-switcher', () => ({ OrganizationSwitcher: () => null }))
vi.mock('@/components/devices-dialog-connected', () => ({ ConnectedDevicesDialog: () => null }))
vi.mock('@/components/feedback-dialog-connected', () => ({ ConnectedFeedbackDialog: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { OrgForm } from './page-content'

const org = { id: 'o1', name: 'Mi Tienda', description: 'Zapatos artesanales', slug: 'mi-tienda' }

beforeEach(() => {
  state.query = { data: org, isLoading: false, error: null }
  state.update = { mutate: vi.fn(), isPending: false, error: null }
})
afterEach(cleanup)

describe('OrgForm', () => {
  it('precarga el nombre Y la descripción reales de la organización', () => {
    render(<OrgForm onBack={() => undefined} />)
    expect((screen.getByPlaceholderText('Nombre de la organización') as HTMLInputElement).value).toBe('Mi Tienda')
    expect((screen.getByPlaceholderText('Descripción') as HTMLInputElement).value).toBe('Zapatos artesanales')
  })

  it('cambiar solo el nombre NO borra la descripción al guardar', () => {
    render(<OrgForm onBack={() => undefined} />)
    fireEvent.change(screen.getByPlaceholderText('Nombre de la organización'), { target: { value: 'Mi Tienda Nueva' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    expect(state.update.mutate).toHaveBeenCalledWith({ name: 'Mi Tienda Nueva', description: 'Zapatos artesanales' })
  })

  it('una organización sin descripción (null) abre con el campo vacío', () => {
    state.query = { data: { ...org, description: null }, isLoading: false, error: null }
    render(<OrgForm onBack={() => undefined} />)
    expect((screen.getByPlaceholderText('Descripción') as HTMLInputElement).value).toBe('')
  })

  it('mientras carga no muestra el formulario (no hay nada que sobrescribir)', () => {
    state.query = { data: undefined, isLoading: true, error: null }
    render(<OrgForm onBack={() => undefined} />)
    expect(screen.queryByPlaceholderText('Descripción')).toBeNull()
    expect(screen.queryByRole('button', { name: /Guardar cambios/ })).toBeNull()
  })

  it('si falla la carga muestra el error y tampoco permite guardar', () => {
    state.query = { data: undefined, isLoading: false, error: new Error('sin conexión') }
    render(<OrgForm onBack={() => undefined} />)
    expect(screen.getByRole('alert').textContent).toContain('sin conexión')
    expect(screen.queryByRole('button', { name: /Guardar cambios/ })).toBeNull()
  })

  it('un error al guardar se muestra', () => {
    state.update = { mutate: vi.fn(), isPending: false, error: new Error('nombre demasiado corto') }
    render(<OrgForm onBack={() => undefined} />)
    expect(screen.getByText(/nombre demasiado corto/)).toBeTruthy()
  })
})
