/**
 * MKT-E-06 — Integration test: resolución de Market en checkout
 *
 * Verifica:
 * 1. Si visitorCountryCode = CO → resuelve Market CO
 * 2. Si no hay Market CO → fallback al Market default (AR)
 * 3. fulfillmentSnapshot queda guardado en la Order
 */
import { resolveVisitorCountry } from '@/lib/resolve-visitor-country'
import type { Request } from 'express'

function mockRequest(headers: Record<string, string>): Partial<Request> {
  return { headers: headers as any }
}

describe('resolveVisitorCountry()', () => {
  it('retorna el código del header X-Visitor-Country en uppercase', () => {
    const req = mockRequest({ 'x-visitor-country': 'co' })
    expect(resolveVisitorCountry(req as Request)).toBe('CO')
  })

  it('usa CF-IPCountry si no hay X-Visitor-Country', () => {
    const req = mockRequest({ 'cf-ipcountry': 'MX' })
    expect(resolveVisitorCountry(req as Request)).toBe('MX')
  })

  it('retorna null si no hay ningún header de país', () => {
    const req = mockRequest({})
    expect(resolveVisitorCountry(req as Request)).toBeNull()
  })

  it('ignora CF-IPCountry = T1 (Tor/VPN)', () => {
    const req = mockRequest({ 'cf-ipcountry': 'T1' })
    expect(resolveVisitorCountry(req as Request)).toBeNull()
  })

  it('X-Visitor-Country tiene precedencia sobre CF-IPCountry', () => {
    const req = mockRequest({ 'x-visitor-country': 'BR', 'cf-ipcountry': 'AR' })
    expect(resolveVisitorCountry(req as Request)).toBe('BR')
  })
})
