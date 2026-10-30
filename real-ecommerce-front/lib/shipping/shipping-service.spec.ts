import { describe, expect, it, vi } from 'vitest'
import { ShippingService } from './shipping-service'
import type { ShipmentDetails, ShippingAdapter } from '@/types/shipping'

const details = { weight: 2, value: 100 } as ShipmentDetails

function adapter(name: string, price: number | Error): ShippingAdapter {
  return {
    name,
    calculateShipping: vi.fn(async () => {
      if (price instanceof Error) throw price
      return { carrier: name, price }
    }),
    createShipment: vi.fn(async () => ({ trackingNumber: `${name}-1`, label: 'L' })),
    getTracking: vi.fn(async () => ({ status: 'ok' })),
  } as unknown as ShippingAdapter
}

describe('ShippingService', () => {
  it('cotiza con todos los transportistas y ordena de menor a mayor precio', async () => {
    const s = new ShippingService()
    s.registerAdapter('a', adapter('a', 300))
    s.registerAdapter('b', adapter('b', 100))
    s.registerAdapter('c', adapter('c', 200))
    expect((await s.getQuotes(details)).map((q) => q.price)).toEqual([100, 200, 300])
  })

  it('un transportista que falla no tumba la cotización de los demás', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const s = new ShippingService()
    s.registerAdapter('a', adapter('a', new Error('API caída')))
    s.registerAdapter('b', adapter('b', 100))
    expect(await s.getQuotes(details)).toHaveLength(1)
    spy.mockRestore()
  })

  it('sin transportistas → lista vacía', async () => {
    expect(await new ShippingService().getQuotes(details)).toEqual([])
  })

  it('createShipment usa el transportista pedido', async () => {
    const s = new ShippingService()
    s.registerAdapter('correo', adapter('correo', 1))
    await expect(s.createShipment(details, 'correo')).resolves.toEqual({ trackingNumber: 'correo-1', label: 'L' })
  })

  it('sin transportista pedido elige según peso y valor (liviano → envia)', async () => {
    const s = new ShippingService()
    const envia = adapter('envia', 1)
    s.registerAdapter('envia', envia)
    await s.createShipment(details)
    expect(envia.createShipment).toHaveBeenCalledWith(details)
  })

  it('un transportista no registrado lanza error', async () => {
    const s = new ShippingService()
    await expect(s.createShipment(details, 'fantasma')).rejects.toThrow('fantasma not found')
    await expect(s.trackShipment('fantasma', 'X')).rejects.toThrow('fantasma not found')
  })

  it('trackShipment delega en el transportista', async () => {
    const s = new ShippingService()
    const a = adapter('envia', 1)
    s.registerAdapter('envia', a)
    await s.trackShipment('envia', 'TRK-1')
    expect(a.getTracking).toHaveBeenCalledWith('TRK-1')
  })
})
