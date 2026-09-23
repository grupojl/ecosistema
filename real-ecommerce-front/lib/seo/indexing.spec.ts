import { describe, it, expect } from 'vitest'
import { indexableLocalesForStore } from '@/lib/seo/indexing'

describe('indexableLocalesForStore (ADR-016 D3 — solo el idioma primario, no toda la UI)', () => {
  it('una tienda con base en Brasil indexa pt', () => {
    expect(indexableLocalesForStore({ countryCode: 'BR' })).toEqual(['pt'])
  })

  it('una tienda con base en Argentina indexa es', () => {
    expect(indexableLocalesForStore({ countryCode: 'AR' })).toEqual(['es'])
  })

  it('país sin mapeo → cae al idioma default, nunca array vacío', () => {
    expect(indexableLocalesForStore({ countryCode: 'XX' })).toEqual(['es'])
  })
})
