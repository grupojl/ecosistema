// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DeleteAccount } from './delete-account'
import { getDictionary } from '@/lib/i18n'

const h = vi.hoisted(() => ({ mutateAsync: vi.fn(), signOut: vi.fn(), setPanel: vi.fn() }))

vi.mock('@/lib/trpc/client', () => ({
  trpc: { customer: { deleteAccount: { useMutation: () => ({ mutateAsync: h.mutateAsync, isPending: false }) } } },
}))
vi.mock('@/components/commerce/commerce-provider', () => ({
  useCommerce: () => ({ dict: getDictionary('es'), signOut: h.signOut, setPanel: h.setPanel }),
}))

const c = getDictionary('es').commerce

describe('DeleteAccount', () => {
  afterEach(cleanup)
  beforeEach(() => { vi.clearAllMocks(); h.mutateAsync.mockResolvedValue(undefined); h.signOut.mockResolvedValue(undefined) })

  it('no borra nada hasta confirmar', async () => {
    render(<DeleteAccount />)
    fireEvent.click(screen.getByRole('button', { name: c.deleteAccount }))
    expect(screen.getByText(c.deleteAccountTitle)).toBeTruthy()
    expect(h.mutateAsync).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: c.cancel }))
    expect(h.mutateAsync).not.toHaveBeenCalled()
  })

  it('al confirmar borra la cuenta, cierra el panel y la sesión', async () => {
    render(<DeleteAccount />)
    fireEvent.click(screen.getByRole('button', { name: c.deleteAccount }))
    fireEvent.click(screen.getByRole('button', { name: c.deleteAccountConfirm }))
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1))
    expect(h.mutateAsync).toHaveBeenCalledTimes(1)
    expect(h.setPanel).toHaveBeenCalledWith(false)
  })

  it('si el borrado falla muestra el error y NO cierra la sesión', async () => {
    h.mutateAsync.mockRejectedValue(new Error('boom'))
    render(<DeleteAccount />)
    fireEvent.click(screen.getByRole('button', { name: c.deleteAccount }))
    fireEvent.click(screen.getByRole('button', { name: c.deleteAccountConfirm }))
    expect(await screen.findByText(c.deleteAccountError)).toBeTruthy()
    expect(h.signOut).not.toHaveBeenCalled()
  })
})
