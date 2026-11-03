// @vitest-environment jsdom
/**
 * Navegación y diálogos de @real/ui con lógica propia (DT-TEST-05): dispositivos y sesiones, paleta de comandos,
 * barra inferior (máx. 5 destinos), selector de idioma y el campo de fecha.
 */
import * as React from 'react'
import { Home, ShoppingBag } from 'lucide-react'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { BottomTabBar } from '../src/components/site'
import { CommandPalette, useCommandShortcut } from '../src/components/command-palette'
import { DateInput } from '../src/components/date-input'
import { DevicesDialog, timeAgo, type DeviceSession } from '../src/components/devices-dialog'
import { LanguageSwitcher } from '../src/components/language-switcher'

beforeAll(() => {
  // jsdom no trae matchMedia / ResizeObserver / scrollIntoView, que Radix y useSizeClass esperan
  window.matchMedia ??= ((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as never
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView ??= () => undefined
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => undefined
  Element.prototype.releasePointerCapture ??= () => undefined
})
afterEach(cleanup)

describe('timeAgo (granularidad real ~1 h, ADR-020)', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()
  it.each([
    [0, 'recién'],
    [90_000, 'recién'],
    [5 * 60_000, 'hace 5 min'],
    [59 * 60_000, 'hace 59 min'],
    [3 * 3_600_000, 'hace 3 h'],
    [23 * 3_600_000, 'hace 23 h'],
    [2 * 86_400_000, 'hace 2 d'],
  ])('hace %d ms → %s', (ms, expected) => expect(timeAgo(ago(ms), now)).toBe(expected))

  it('una fecha futura (reloj desfasado) no da un valor negativo', () => {
    expect(timeAgo(new Date(now + 3_600_000), now)).toBe('recién')
  })
})

describe('DevicesDialog', () => {
  const session = (over: Partial<DeviceSession> = {}): DeviceSession => ({
    id: 's1', deviceType: 'desktop', browser: 'Chrome 150', os: 'Windows', ipPrefix: '1.2.3.0/24', country: 'AR',
    createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), isCurrent: false, ...over,
  } as DeviceSession)
  const props = (over: Record<string, unknown> = {}) => ({
    open: true, onOpenChange: vi.fn(), sessions: [] as DeviceSession[], isLoading: false, onRevoke: vi.fn(), onRevokeOthers: vi.fn(), ...over,
  })
  const dialog = () => screen.getByRole('dialog', { name: 'Dispositivos' })

  it('cargando muestra marcadores; con error, el mensaje; sin sesiones, el texto vacío', () => {
    const view = render(<DevicesDialog {...props({ isLoading: true, sessions: undefined })} />)
    expect(dialog().querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]').length).toBeGreaterThan(0)
    view.rerender(<DevicesDialog {...props({ error: 'No pudimos cargar' })} />)
    expect(within(dialog()).getByText('No pudimos cargar')).toBeTruthy()
    view.rerender(<DevicesDialog {...props()} />)
    expect(within(dialog()).getByText(/No hay sesiones registradas/)).toBeTruthy()
  })

  it('titula cada sesión con navegador y SO, o «Dispositivo desconocido»', () => {
    render(<DevicesDialog {...props({ sessions: [session(), session({ id: 's2', browser: null, os: null })] })} />)
    expect(within(dialog()).getByText('Chrome 150 en Windows')).toBeTruthy()
    expect(within(dialog()).getByText('Dispositivo desconocido')).toBeTruthy()
  })

  it('marca «Este dispositivo» y ofrece «Cerrar sesión» solo en la actual (si hay onLogout)', () => {
    const onLogout = vi.fn()
    render(<DevicesDialog {...props({ sessions: [session({ id: 'cur', isCurrent: true }), session({ id: 'otra' })], onLogout })} />)
    expect(within(dialog()).getByText('Este dispositivo')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cerrar sesión' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('sin onLogout la sesión actual no ofrece cerrarse', () => {
    render(<DevicesDialog {...props({ sessions: [session({ isCurrent: true })] })} />)
    expect(within(dialog()).queryByRole('button', { name: 'Cerrar sesión' })).toBeNull()
  })

  it('cerrar OTRA sesión llama a onRevoke con su id; la actual no se puede «cerrar» por esa vía', () => {
    const p = props({ sessions: [session({ id: 'cur', isCurrent: true }), session({ id: 'otra' })] })
    render(<DevicesDialog {...p} />)
    const rows = dialog().querySelectorAll('.rounded-lg.border')
    expect(rows).toHaveLength(2)
    fireEvent.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Cerrar', exact: true }))
    expect(p.onRevoke).toHaveBeenCalledWith('otra')
    expect(within(rows[0] as HTMLElement).queryByRole('button', { name: 'Cerrar', exact: true })).toBeNull()
  })

  it('«Cerrar las demás sesiones (n)» aparece solo si hay otras y las revoca', () => {
    const view = render(<DevicesDialog {...props({ sessions: [session({ isCurrent: true })] })} />)
    expect(within(dialog()).queryByText(/Cerrar las demás/)).toBeNull()
    const p = props({ sessions: [session({ id: 'cur', isCurrent: true }), session({ id: 'a' }), session({ id: 'b' })] })
    view.rerender(<DevicesDialog {...p} />)
    fireEvent.click(within(dialog()).getByRole('button', { name: /Cerrar las demás sesiones \(2\)/ }))
    expect(p.onRevokeOthers).toHaveBeenCalledTimes(1)
  })

  it('mientras revoca, el botón de esa sesión se deshabilita', () => {
    render(<DevicesDialog {...props({ sessions: [session({ id: 'otra' })], revokingId: 'otra' })} />)
    const row = dialog().querySelector('.rounded-lg.border') as HTMLElement
    expect((within(row).getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('CommandPalette', () => {
  const make = () => {
    const cmds = [
      { id: 'a', label: 'Ir a Pedidos', group: 'Tienda', keywords: 'ordenes compras', onSelect: vi.fn() },
      { id: 'b', label: 'Ir a Productos', group: 'Tienda', onSelect: vi.fn() },
      { id: 'c', label: 'Cambiar tema', group: 'Ajustes', onSelect: vi.fn() },
    ]
    const onOpenChange = vi.fn()
    const view = render(<CommandPalette open onOpenChange={onOpenChange} commands={cmds} />)
    return { cmds, onOpenChange, view, input: () => screen.getByRole('combobox', { name: 'Buscar' }) as HTMLInputElement }
  }

  it('lista todos los comandos y filtra por etiqueta, grupo o palabras clave', () => {
    const { input } = make()
    expect(screen.getAllByRole('option')).toHaveLength(3)
    fireEvent.change(input(), { target: { value: 'ordenes' } }) // palabra clave
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ir a PedidosTienda'])
    fireEvent.change(input(), { target: { value: 'AJUSTES' } }) // grupo, sin distinguir mayúsculas
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cambiar temaAjustes'])
  })

  it('sin coincidencias muestra el texto vacío', () => {
    const { input } = make()
    fireEvent.change(input(), { target: { value: 'zzzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('Sin resultados')).toBeTruthy()
  })

  it('teclado: ↓ Enter ejecuta el segundo y cierra; ↑ no pasa del primero', () => {
    const { input, cmds, onOpenChange } = make()
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    expect(input().getAttribute('aria-activedescendant')).toBe('cmd-opt-0')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(cmds[1]!.onSelect).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('↓ no pasa del último', () => {
    const { input } = make()
    for (let i = 0; i < 10; i++) fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(input().getAttribute('aria-activedescendant')).toBe('cmd-opt-2')
  })

  it('al filtrar, la opción activa vuelve a la primera; Enter sin resultados no hace nada', () => {
    const { input, cmds } = make()
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.change(input(), { target: { value: 'tema' } })
    expect(input().getAttribute('aria-activedescendant')).toBe('cmd-opt-0')
    fireEvent.change(input(), { target: { value: 'nada' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(cmds.every((c) => c.onSelect.mock.calls.length === 0)).toBe(true)
  })

  it('el clic ejecuta el comando', () => {
    const { cmds } = make()
    fireEvent.click(screen.getByRole('option', { name: /Cambiar tema/ }))
    expect(cmds[2]!.onSelect).toHaveBeenCalledTimes(1)
  })

  it('se limpia la búsqueda al cerrar', () => {
    const { view, cmds } = make()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tema' } })
    view.rerender(<CommandPalette open={false} onOpenChange={vi.fn()} commands={cmds} />)
    view.rerender(<CommandPalette open onOpenChange={vi.fn()} commands={cmds} />)
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('')
  })
})

describe('useCommandShortcut (Ctrl/⌘ K)', () => {
  it('Ctrl+K y ⌘+K abren; otras teclas no; y se desuscribe', () => {
    const onOpen = vi.fn()
    const { unmount } = renderHook(() => useCommandShortcut(onOpen))
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'K', metaKey: true })
    fireEvent.keyDown(window, { key: 'k' })
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })
    expect(onOpen).toHaveBeenCalledTimes(2)
    unmount()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('el atajo se muestra según el sistema (⌘ K en Mac, Ctrl K en el resto)', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    expect(renderHook(() => useCommandShortcut(() => undefined)).result.current).toBe('⌘ K')
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32')
    expect(renderHook(() => useCommandShortcut(() => undefined)).result.current).toBe('Ctrl K')
    vi.restoreAllMocks()
  })
})

describe('BottomTabBar (máx. 5 destinos, solo compact)', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, label: `Tab ${i}`, icon: i % 2 ? ShoppingBag : Home, href: `/${i}` }))

  it('muestra como máximo 5 destinos aunque se pasen más', () => {
    render(<BottomTabBar items={items(8)} />)
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })

  it('marca el activo con aria-current y deja el resto sin marcar', () => {
    render(<BottomTabBar items={items(3)} activeId="t1" label="Tienda" />)
    const nav = screen.getByRole('navigation', { name: 'Tienda' })
    const current = nav.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.textContent).toContain('Tab 1')
  })

  it('un destino sin href es un botón que llama a onClick; la insignia muestra la cantidad', () => {
    const onClick = vi.fn()
    render(<BottomTabBar items={[{ id: 'bag', label: 'Bolsa', icon: ShoppingBag, onClick, badge: 3 }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Bolsa/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('con un componente de enlace propio (next/link) lo usa', () => {
    const Link = ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a data-link="1" href={href} {...r}>{children}</a>
    render(<BottomTabBar linkAs={Link} items={items(2)} />)
    expect(document.querySelectorAll('[data-link="1"]')).toHaveLength(2)
  })
})

describe('LanguageSwitcher', () => {
  const options = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }]

  it('el botón describe el idioma actual y notifica el cambio', async () => {
    const onChange = vi.fn()
    render(<LanguageSwitcher value="es" options={options} onChange={onChange} label="Idioma" />)
    const trigger = screen.getByRole('button', { name: 'Idioma: Español' })
    expect(trigger.textContent).toContain('Español')
    // Radix abre el menú con el teclado (Enter) o con pointerdown; jsdom no sintetiza el pointerdown de un click
    await act(async () => { fireEvent.keyDown(trigger, { key: 'Enter' }) })
    const english = await screen.findByRole('menuitem', { name: /English/ })
    await act(async () => { fireEvent.click(english) })
    expect(onChange).toHaveBeenCalledWith('en')
  })

  it('la variante compacta oculta el texto y un valor desconocido se muestra tal cual', () => {
    render(<LanguageSwitcher value="fr" options={options} onChange={vi.fn()} label="Idioma" compact />)
    const trigger = screen.getByRole('button', { name: 'Idioma: fr' })
    expect(trigger.textContent).toBe('')
  })
})

describe('DateInput', () => {
  it('es un input de fecha nativo (type=date) que reenvía el resto de props', () => {
    const onChange = vi.fn()
    render(<DateInput aria-label="Vence" min="2026-01-01" onChange={onChange} />)
    const input = screen.getByLabelText('Vence') as HTMLInputElement
    expect(input.type).toBe('date')
    expect(input.min).toBe('2026-01-01')
    fireEvent.change(input, { target: { value: '2026-12-31' } })
    expect(onChange).toHaveBeenCalled()
    expect(input.value).toBe('2026-12-31')
  })
})
