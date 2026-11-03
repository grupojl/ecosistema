// @vitest-environment jsdom
/**
 * Comportamiento y accesibilidad de los componentes base de @real/ui (DT-TEST-05).
 * Se prueba lo que el norte de UI (ADR-024) declara no negociable: roles/etiquetas accesibles, los 4 estados de una
 * vista, errores asociados al campo, paginación con `aria-current`, objetivos táctiles de 44 px y que el botón con
 * `asChild` no genere un <button> dentro de un enlace.
 */
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Button } from '../src/components/button'
import { EmptyState } from '../src/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '../src/components/alert'
import { Field, FieldError } from '../src/components/field'
import { Input } from '../src/components/input'
import { Pagination } from '../src/components/pagination'
import { QuantityStepper } from '../src/components/quantity-stepper'
import { SegmentedControl } from '../src/components/segmented-control'
import { LoadingState, PageHeader, SectionTabs, Spinner, StatCard } from '../src/components/page'

afterEach(cleanup)

describe('Button', () => {
  it('es un <button> accesible y dispara onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Guardar</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled no dispara onClick', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Guardar</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('el tamaño por defecto y el icono cumplen el objetivo táctil de 44 px (h-11)', () => {
    render(<><Button>a</Button><Button size="icon" aria-label="x" /></>)
    for (const b of screen.getAllByRole('button')) expect(b.className).toMatch(/\bh-11\b/)
  })

  it('asChild sobre un enlace renderiza SOLO <a>, sin <button> anidado', () => {
    render(<Button asChild><a href="/ruta">Ir</a></Button>)
    const link = screen.getByRole('link', { name: 'Ir' })
    expect(link.tagName).toBe('A')
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('EmptyState: vacío, error y sin permisos', () => {
  it('vacío: texto por defecto, sin role=alert', () => {
    render(<EmptyState />)
    expect(screen.getByText('Todavía no hay nada acá')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('error: role=alert y «Reintentar» llama a onRetry', () => {
    const onRetry = vi.fn()
    render(<EmptyState kind="error" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('error sin onRetry no muestra el botón', () => {
    render(<EmptyState kind="error" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('sin permisos: mensaje propio y sin botón de reintento', () => {
    render(<EmptyState kind="forbidden" onRetry={() => {}} />)
    expect(screen.getByText('No tenés acceso a este módulo')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('una acción propia reemplaza a «Reintentar»', () => {
    render(<EmptyState kind="error" onRetry={() => {}} action={<button>Contactar</button>} />)
    expect(screen.getByRole('button', { name: 'Contactar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull()
  })
})

describe('Alert', () => {
  it('destructive y warning son role=alert; el resto, status', () => {
    render(
      <>
        <Alert variant="destructive"><AlertTitle>Rojo</AlertTitle><AlertDescription>d</AlertDescription></Alert>
        <Alert variant="warning">Aviso</Alert>
        <Alert>Info</Alert>
      </>,
    )
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })
})

describe('Field / FieldError', () => {
  it('asocia la etiqueta al control y, con error, marca aria-invalid y aria-describedby', () => {
    render(
      <Field id="sku" label="SKU" hint="Único por tienda" error="Ya existe">
        {(a11y) => <Input id="sku" {...a11y} />}
      </Field>,
    )
    const input = screen.getByLabelText('SKU')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const described = input.getAttribute('aria-describedby')!.split(' ')
    expect(described).toEqual(['sku-hint', 'sku-error'])
    expect(document.getElementById('sku-error')?.textContent).toContain('Ya existe')
    expect(screen.getByRole('alert').textContent).toContain('Ya existe')
  })

  it('sin error ni hint no agrega atributos aria', () => {
    render(<Field id="n" label="Nombre">{(a11y) => <Input id="n" {...a11y} />}</Field>)
    const input = screen.getByLabelText('Nombre')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
  })

  it('FieldError anuncia el error (role=alert)', () => {
    render(<FieldError>Falta el email</FieldError>)
    expect(screen.getByRole('alert').textContent).toContain('Falta el email')
  })
})

describe('Pagination', () => {
  it('no se muestra con una sola página', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onPageChange={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('marca la página actual con aria-current y deshabilita «anterior» en el extremo', () => {
    render(<Pagination page={1} pageCount={5} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Página 1' }).getAttribute('aria-current')).toBe('page')
    expect((screen.getByRole('button', { name: 'Página anterior' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Página siguiente' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('con muchas páginas usa elipsis y navega', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={10} pageCount={20} onPageChange={onPageChange} />)
    const nav = screen.getByRole('navigation', { name: 'Paginación' })
    expect(within(nav).getAllByText('…')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(onPageChange).toHaveBeenCalledWith(11)
    fireEvent.click(screen.getByRole('button', { name: 'Página 20' }))
    expect(onPageChange).toHaveBeenCalledWith(20)
  })

  it('«siguiente» se deshabilita en la última página', () => {
    render(<Pagination page={5} pageCount={5} onPageChange={() => {}} />)
    expect((screen.getByRole('button', { name: 'Página siguiente' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('QuantityStepper', () => {
  function Harness({ min, max }: { min?: number; max?: number }) {
    const [v, setV] = React.useState(2)
    return <QuantityStepper value={v} onValueChange={setV} label="Cantidad" min={min} max={max} decreaseLabel="Menos" increaseLabel="Más" />
  }

  it('incrementa y decrementa', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Más' }))
    expect(screen.getByRole('group', { name: 'Cantidad' }).textContent).toContain('3')
    fireEvent.click(screen.getByRole('button', { name: 'Menos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Menos' }))
    expect(screen.getByRole('group', { name: 'Cantidad' }).textContent).toContain('1')
  })

  it('respeta mínimo y máximo (botones deshabilitados, sin pasarse)', () => {
    render(<Harness min={2} max={3} />)
    expect((screen.getByRole('button', { name: 'Menos' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Más' }))
    expect((screen.getByRole('button', { name: 'Más' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('SegmentedControl', () => {
  it('marca la opción activa con aria-pressed y notifica el cambio', () => {
    const onValueChange = vi.fn()
    render(
      <SegmentedControl
        aria-label="Vista"
        value="a"
        onValueChange={onValueChange}
        options={[{ value: 'a', label: 'Lista' }, { value: 'b', label: 'Tarjetas' }]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Lista' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Tarjetas' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }))
    expect(onValueChange).toHaveBeenCalledWith('b')
    expect(screen.getByRole('group', { name: 'Vista' })).toBeTruthy()
  })
})

describe('estructura de página', () => {
  it('PageHeader tiene un único <h1> con el título', () => {
    render(<PageHeader title="Pedidos" description="Todos los pedidos" />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Pedidos')
  })

  it('LoadingState y Spinner anuncian estado de carga', () => {
    render(<><LoadingState /><Spinner /></>)
    const statuses = screen.getAllByRole('status')
    expect(statuses).toHaveLength(2)
    expect(statuses[0]!.getAttribute('aria-busy')).toBe('true')
  })

  it('SectionTabs marca la pestaña activa con aria-current', () => {
    render(
      <SectionTabs
        label="Secciones"
        items={[{ href: '/a', label: 'Uno' }, { href: '/b', label: 'Dos' }]}
        isActive={(href) => href === '/a'}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(nav).getAllByRole('link')).toHaveLength(2)
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('StatCard muestra la cifra y su etiqueta', () => {
    render(<StatCard label="Ventas" value="1.234" />)
    expect(screen.getByText('Ventas')).toBeTruthy()
    expect(screen.getByText('1.234')).toBeTruthy()
  })
})
