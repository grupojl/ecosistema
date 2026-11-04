import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney as formatMoneyArs, formatRelativeTime, getInitials } from '@/lib/helpers'
import {
  HANDLE_REGEX, ORDER_STATUSES, ORDER_STATUS_BADGE, ORDER_STATUS_LABEL, PRODUCT_STATUS_BADGE, PRODUCT_STATUS_LABEL, formatMoney, slugify, toCents,
} from './format'

describe('estados de orden: cada estado que guarda la base tiene etiqueta y color', () => {
  // Los estados reales (enum OrderStatus de ecommerce-back). Si se agrega uno, este test obliga a darle etiqueta.
  const DB_STATUSES = ['PENDING_PAYMENT', 'PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']

  it('la lista, las etiquetas y los colores cubren EXACTAMENTE los estados de la base', () => {
    expect([...ORDER_STATUSES].sort()).toEqual([...DB_STATUSES].sort())
    expect(Object.keys(ORDER_STATUS_LABEL).sort()).toEqual([...DB_STATUSES].sort())
    expect(Object.keys(ORDER_STATUS_BADGE).sort()).toEqual([...DB_STATUSES].sort())
  })

  it('una orden recién creada se ve como «Pendiente de pago», no sin etiqueta', () => {
    expect(ORDER_STATUS_LABEL['PENDING_PAYMENT']).toBe('Pendiente de pago')
    expect(ORDER_STATUS_BADGE['PENDING_PAYMENT']).toBe('secondary')
    expect(ORDER_STATUS_LABEL['FULFILLING']).toBe('En preparación')
  })

  it('cancelada y reembolsada se destacan como destructivas', () => {
    expect(ORDER_STATUS_BADGE['CANCELLED']).toBe('destructive')
    expect(ORDER_STATUS_BADGE['REFUNDED']).toBe('destructive')
  })

  it('productos: etiquetas y colores de sus tres estados', () => {
    expect(Object.keys(PRODUCT_STATUS_LABEL).sort()).toEqual(['ARCHIVED', 'DRAFT', 'PUBLISHED'])
    expect(Object.keys(PRODUCT_STATUS_BADGE).sort()).toEqual(['ARCHIVED', 'DRAFT', 'PUBLISHED'])
  })
})

describe('dinero', () => {
  it('formatMoney pasa de centavos a moneda local', () => {
    expect(formatMoney(150000, 'ARS').replace(/\s/g, ' ')).toMatch(/1\.500,00/)
  })

  it('una moneda inválida no rompe la pantalla: muestra el número y el código', () => {
    expect(formatMoney(12345, 'NO-ES-MONEDA')).toBe('123.45 NO-ES-MONEDA')
  })

  it('toCents acepta coma o punto y rechaza lo que no es número', () => {
    expect(toCents('12,50')).toBe(1250)
    expect(toCents(' 12.5 ')).toBe(1250)
    expect(toCents('0,07')).toBe(7)
    expect(toCents('19.99')).toBe(1999) // sin error de coma flotante (19.99*100 = 1998.9999…)
    expect(toCents('abc')).toBeNaN()
    expect(toCents('')).toBe(0)
  })

  it('formatMoney de helpers (monto entero, sin decimales)', () => {
    expect(formatMoneyArs(1500).replace(/\s/g, ' ')).toMatch(/1\.500/)
    expect(formatMoneyArs(1500)).not.toMatch(/,/)
  })
})

describe('handles y slugs', () => {
  it('slugify quita acentos, símbolos y bordes', () => {
    expect(slugify('  Zapatilla Ñandú — Edición 2026!  ')).toBe('zapatilla-nandu-edicion-2026')
    expect(slugify('---')).toBe('')
  })

  it('lo que produce slugify siempre es un handle válido (si no está vacío)', () => {
    for (const t of ['Café con Leche', 'a  b', 'X_Y.Z', '100% Algodón']) expect(HANDLE_REGEX.test(slugify(t))).toBe(true)
  })

  it('HANDLE_REGEX rechaza mayúsculas, espacios y guiones sobrantes', () => {
    for (const bad of ['Zapato', 'a b', '-a', 'a-', 'a--b', '']) expect(HANDLE_REGEX.test(bad)).toBe(false)
    for (const good of ['zapato', 'a-b-c', 'x1']) expect(HANDLE_REGEX.test(good)).toBe(true)
  })
})

describe('helpers de fecha y nombre', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

  it('formatRelativeTime: ahora, minutos, horas y fecha', () => {
    expect(formatRelativeTime(ago(10_000))).toBe('ahora')
    expect(formatRelativeTime(ago(5 * 60_000))).toBe('5m')
    expect(formatRelativeTime(ago(3 * 3_600_000))).toBe('3h')
    expect(formatRelativeTime(ago(3 * 86_400_000))).toMatch(/^\d{1,2}\/\d{1,2}$/) // es-AR no rellena el día con cero ("1/11")
  })

  it('formatDate usa el formato local con hora', () => {
    expect(formatDate('2026-03-05T14:30:00')).toMatch(/05\/03\/26/)
  })

  it('getInitials toma hasta dos iniciales en mayúsculas', () => {
    expect(getInitials('ana pérez')).toBe('AP')
    expect(getInitials('Juan Carlos de la Vega')).toBe('JC')
    expect(getInitials('madonna')).toBe('M')
  })
})
