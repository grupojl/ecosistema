import { describe, expect, it } from 'vitest'
import { visitorCountryHeader } from './visitor-country-header'

describe('visitorCountryHeader', () => {
  it('manda el país en mayúsculas', () => {
    expect(visitorCountryHeader('co')).toEqual({ 'x-visitor-country': 'CO' })
    expect(visitorCountryHeader(' br ')).toEqual({ 'x-visitor-country': 'BR' })
  })

  it('sin país no manda header (el back usa Cloudflare o el Market default)', () => {
    expect(visitorCountryHeader(null)).toEqual({})
    expect(visitorCountryHeader(undefined)).toEqual({})
    expect(visitorCountryHeader('')).toEqual({})
  })

  it('descarta valores que no son un código de 2 letras', () => {
    for (const bad of ['ARG', 'A', '1A', 'A-', 'default', 'AR\r\nX-Evil: 1']) {
      expect(visitorCountryHeader(bad)).toEqual({})
    }
  })
})
