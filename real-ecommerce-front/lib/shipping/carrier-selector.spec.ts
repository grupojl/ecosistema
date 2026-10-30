import { describe, expect, it } from 'vitest'
import { selectCarrier } from './carrier-selector'

describe('selectCarrier', () => {
  it('paquete liviano (< 5 kg) → envia, sin importar el valor', () => {
    expect(selectCarrier(0.5, 10)).toBe('envia')
    expect(selectCarrier(4.99, 100_000)).toBe('envia')
  })

  it('mediano (5–20 kg) con valor 50–2000 → welivery, incluidos los bordes', () => {
    expect(selectCarrier(5, 50)).toBe('welivery')
    expect(selectCarrier(20, 2000)).toBe('welivery')
    expect(selectCarrier(12, 500)).toBe('welivery')
  })

  it('pesado (> 20 kg) → correo', () => {
    expect(selectCarrier(20.01, 100)).toBe('correo')
  })

  it('valor alto (> 2000) → correo aunque el peso sea mediano', () => {
    expect(selectCarrier(10, 2000.01)).toBe('correo')
  })

  it('mediano de poco valor (< 50) cae a welivery por defecto', () => {
    expect(selectCarrier(10, 10)).toBe('welivery')
  })
})
