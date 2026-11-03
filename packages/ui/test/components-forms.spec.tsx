// @vitest-environment jsdom
/**
 * Componentes con más lógica de @real/ui (DT-TEST-05): el panel de ingreso (todos los frontends lo usan para autenticar),
 * el combobox accesible, el breadcrumb, el selector nativo y la clase de tamaño. Se prueba comportamiento y a11y.
 */
import * as React from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Breadcrumb } from '../src/components/breadcrumb'
import { Combobox } from '../src/components/combobox'
import { LoginPanel, AUTH_ERRORS } from '../src/components/login-panel'
import { NativeSelect } from '../src/components/native-select'
import { EXPANDED_MIN, MEDIUM_MIN, useSizeClass } from '../src/hooks/use-size-class'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  try { window.localStorage.clear() } catch { /* ignorar */ }
})

const providers = [
  { id: 'google', label: 'Continuar con Google', icon: <span>G</span> },
  { id: 'apple', label: 'Continuar con Apple', icon: <span>A</span> },
]

describe('LoginPanel: proveedores', () => {
  it('lista los proveedores como botones y llama a onSignIn con su id; luego onSuccess', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    render(<LoginPanel providers={providers} onSignIn={onSignIn} onSuccess={onSuccess} />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('con Google'))
    expect(onSignIn).toHaveBeenCalledWith('google')
  })

  it('mientras conecta deshabilita todos los botones y muestra la etiqueta de conexión', async () => {
    let finish!: () => void
    const onSignIn = vi.fn(() => new Promise<void>((r) => { finish = r }))
    render(<LoginPanel providers={providers} onSignIn={onSignIn} connectingLabel="Ingresando…" />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }))
    expect(await screen.findByText('Ingresando…')).toBeTruthy()
    for (const b of screen.getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(true)
    await act(async () => finish())
    await waitFor(() => expect(screen.queryByText('Ingresando…')).toBeNull())
  })

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'])(
    'cerrar la ventana del proveedor (%s) NO es un error',
    async (code) => {
      const onSignIn = vi.fn().mockRejectedValue({ code })
      render(<LoginPanel providers={providers} onSignIn={onSignIn} />)
      fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }))
      await waitFor(() => expect(onSignIn).toHaveBeenCalled())
      expect(screen.queryByRole('alert')).toBeNull()
    },
  )

  it('traduce los errores conocidos de Firebase y usa un mensaje genérico para el resto', async () => {
    const onSignIn = vi.fn().mockRejectedValueOnce({ code: 'auth/popup-blocked' }).mockRejectedValueOnce(new Error('rareza'))
    render(<LoginPanel providers={providers} onSignIn={onSignIn} />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }))
    expect(await screen.findByText(AUTH_ERRORS['auth/popup-blocked']!.title)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }))
    expect(await screen.findByText('No pudimos iniciar sesión')).toBeTruthy()
  })

  it('los mensajes propios (i18n) reemplazan a los de fábrica', async () => {
    const onSignIn = vi.fn().mockRejectedValue({ code: 'auth/network-request-failed' })
    render(
      <LoginPanel providers={providers} onSignIn={onSignIn} messages={{ errors: { 'auth/network-request-failed': { title: 'Offline', text: 'Sin red' } } }} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }))
    expect(await screen.findByText('Offline')).toBeTruthy()
  })

  it('recuerda el último proveedor usado', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined)
    const { unmount } = render(<LoginPanel providers={providers} onSignIn={onSignIn} lastUsedKey="k" />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Apple/ }))
    await waitFor(() => expect(window.localStorage.getItem('k')).toBe('apple'))
    unmount()
    render(<LoginPanel providers={providers} onSignIn={onSignIn} lastUsedKey="k" />)
    expect(await screen.findByText('Último usado')).toBeTruthy()
  })
})

describe('LoginPanel: código por correo', () => {
  const emailFlow = () => ({ sendCode: vi.fn().mockResolvedValue(undefined), verifyCode: vi.fn().mockResolvedValue(undefined) })

  it('sin emailFlow no ofrece el ingreso por correo', () => {
    render(<LoginPanel providers={providers} onSignIn={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Continuar con el correo/ })).toBeNull()
  })

  it('valida el formato del correo antes de enviar', async () => {
    const flow = emailFlow()
    render(<LoginPanel providers={providers} onSignIn={vi.fn()} emailFlow={flow} />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar con el correo/ }))
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'no-es-correo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect((await screen.findByRole('alert')).textContent).toContain('El correo no es válido')
    expect(flow.sendCode).not.toHaveBeenCalled()
  })

  it('flujo completo: envía el código, solo acepta dígitos, verifica y muestra «Sesión iniciada»', async () => {
    const flow = emailFlow()
    const onSuccess = vi.fn()
    render(<LoginPanel providers={providers} onSignIn={vi.fn()} emailFlow={flow} onSuccess={onSuccess} />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar con el correo/ }))
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@x.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    const code = await screen.findByLabelText('Código de 6 dígitos')
    expect(flow.sendCode).toHaveBeenCalledWith('ana@x.com')

    const enter = () => screen.getByRole('button', { name: 'Entrar' }) as HTMLButtonElement
    fireEvent.change(code, { target: { value: '12ab34' } })
    expect((code as HTMLInputElement).value).toBe('1234') // las letras se descartan
    expect(enter().disabled).toBe(true) // faltan dígitos
    fireEvent.change(code, { target: { value: '123456' } })
    expect(enter().disabled).toBe(false)
    fireEvent.click(enter())

    await waitFor(() => expect(flow.verifyCode).toHaveBeenCalledWith('ana@x.com', '123456'))
    expect(await screen.findByText('Sesión iniciada')).toBeTruthy()
    expect(onSuccess).toHaveBeenCalledWith('con un código por correo')
  })

  it('un código incorrecto muestra su error y deja reintentar', async () => {
    const flow = emailFlow()
    flow.verifyCode.mockRejectedValue({ code: 'auth/invalid-verification-code' })
    render(<LoginPanel providers={providers} onSignIn={vi.fn()} emailFlow={flow} />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar con el correo/ }))
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@x.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(AUTH_ERRORS['auth/invalid-verification-code']!.title)).toBeTruthy()
    expect(screen.queryByText('Sesión iniciada')).toBeNull()
  })
})

describe('Combobox', () => {
  const options = [
    { value: 'ar', label: 'Argentina' },
    { value: 'br', label: 'Brasil' },
    { value: 'cl', label: 'Chile' },
  ]
  function Harness({ initial = null as string | null, onChange = vi.fn() }) {
    const [v, setV] = React.useState<string | null>(initial)
    return <Combobox id="pais" options={options} value={v} onValueChange={(x) => { setV(x); onChange(x) }} listLabel="Países" emptyText="Sin resultados" />
  }

  it('muestra la opción elegida y filtra al escribir (sin distinguir mayúsculas)', () => {
    render(<Harness initial="br" />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input.value).toBe('Brasil')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'CH' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Chile'])
  })

  it('sin coincidencias muestra el texto vacío', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getAllByText('Sin resultados').length).toBeGreaterThan(0)
  })

  it('teclado: ↓ Enter elige la segunda (la primera ya está activa al abrir), Esc cierra sin elegir', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('br')
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.focus(input)
    expect(screen.getByRole('listbox', { name: 'Países' })).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('expone el patrón ARIA: expanded, controls y la opción activa', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    fireEvent.focus(input)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id)
    expect(input.getAttribute('aria-activedescendant')).toBe('pais-opt-0')
  })

  it('elegir con el puntero marca la opción', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Chile' }))
    expect(onChange).toHaveBeenCalledWith('cl')
  })
})

describe('Breadcrumb', () => {
  it('los niveles previos son enlaces y la página actual lleva aria-current', () => {
    render(<Breadcrumb items={[{ label: 'Inicio', href: '/' }, { label: 'Productos', href: '/p' }, { label: 'Zapato' }]} />)
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy()
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/', '/p'])
    const current = screen.getByText('Zapato')
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(current.closest('a')).toBeNull()
  })

  it('el último elemento nunca es enlace aunque traiga href, y acepta un componente de enlace propio', () => {
    const Custom = ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a data-custom="1" href={href} {...rest}>{children}</a>
    render(<Breadcrumb linkAs={Custom} items={[{ label: 'A', href: '/a' }, { label: 'B', href: '/b' }]} />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link').getAttribute('data-custom')).toBe('1')
  })
})

describe('NativeSelect', () => {
  it('es un <select> nativo accesible que notifica el cambio', () => {
    const onChange = vi.fn()
    render(
      <NativeSelect aria-label="Servicio" defaultValue="a" onChange={onChange}>
        <option value="a">Uno</option>
        <option value="b">Dos</option>
      </NativeSelect>,
    )
    const select = screen.getByLabelText('Servicio') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    fireEvent.change(select, { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalled()
    expect(select.value).toBe('b')
  })
})

describe('useSizeClass (compact < 600 · medium 600–839 · expanded ≥ 840)', () => {
  type Listener = () => void
  let width = 1000
  const listeners = new Set<Listener>()

  beforeEach(() => {
    listeners.clear()
    vi.stubGlobal('matchMedia', (query: string) => {
      const min = Number(/min-width:\s*(\d+)px/.exec(query)![1])
      return {
        get matches() { return width >= min },
        addEventListener: (_: string, l: Listener) => listeners.add(l),
        removeEventListener: (_: string, l: Listener) => listeners.delete(l),
      }
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('clasifica el ancho en los tres rangos exactos', () => {
    for (const [w, expected] of [[320, 'compact'], [MEDIUM_MIN - 1, 'compact'], [MEDIUM_MIN, 'medium'], [EXPANDED_MIN - 1, 'medium'], [EXPANDED_MIN, 'expanded']] as const) {
      width = w
      const { result, unmount } = renderHook(() => useSizeClass())
      expect(result.current, `${w}px`).toBe(expected)
      unmount()
    }
  })

  it('se actualiza sola al girar o redimensionar', () => {
    width = 1000
    const { result } = renderHook(() => useSizeClass())
    expect(result.current).toBe('expanded')
    act(() => { width = 400; listeners.forEach((l) => l()) })
    expect(result.current).toBe('compact')
  })
})
