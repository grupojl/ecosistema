import { describe, expect, it, vi } from 'vitest'
import { clearAuthHint, initialsOf, readAuthHint, writeAuthHint } from './auth-hint'

const KEY = 'welver.sass.auth-hint'

function storage(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[KEY, initial]])
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

describe('readAuthHint', () => {
  it('lee una pista válida', () => {
    expect(readAuthHint(storage(JSON.stringify({ initials: 'AB', photoUrl: 'https://x/y.png' })))).toEqual({
      initials: 'AB', photoUrl: 'https://x/y.png',
    })
  })

  it('sin pista, storage nulo o JSON roto → null (nunca lanza)', () => {
    expect(readAuthHint(storage())).toBeNull()
    expect(readAuthHint(null)).toBeNull()
    expect(readAuthHint(undefined)).toBeNull()
    expect(readAuthHint(storage('{no-json'))).toBeNull()
  })

  it('rechaza iniciales inválidas (vacías, largas o de otro tipo)', () => {
    for (const initials of ['', 'ABCDE', 5, null]) {
      expect(readAuthHint(storage(JSON.stringify({ initials, photoUrl: null })))).toBeNull()
    }
  })

  it('solo acepta fotos https (el almacenamiento lo puede tocar cualquier script del origen)', () => {
    for (const photoUrl of ['http://x/y.png', 'javascript:alert(1)', 'data:image/png;base64,AAA', 42]) {
      expect(readAuthHint(storage(JSON.stringify({ initials: 'AB', photoUrl })))?.photoUrl).toBeNull()
    }
    expect(readAuthHint(storage(JSON.stringify({ initials: 'AB' })))?.photoUrl).toBeNull()
  })

  it('un storage que lanza se trata como "sin pista"', () => {
    const roto = { getItem: () => { throw new Error('SecurityError') } }
    expect(readAuthHint(roto)).toBeNull()
  })
})

describe('writeAuthHint / clearAuthHint', () => {
  it('escribe solo lo que muestra el navbar y se puede volver a leer', () => {
    const s = storage()
    writeAuthHint(s, { initials: 'JP', photoUrl: null })
    expect(JSON.parse(s.data.get(KEY)!)).toEqual({ initials: 'JP', photoUrl: null })
    expect(readAuthHint(s)).toEqual({ initials: 'JP', photoUrl: null })
  })

  it('clear la borra', () => {
    const s = storage(JSON.stringify({ initials: 'JP', photoUrl: null }))
    clearAuthHint(s)
    expect(readAuthHint(s)).toBeNull()
  })

  it('no lanzan si el storage está bloqueado o ausente', () => {
    const roto = { setItem: vi.fn(() => { throw new Error('Quota') }), removeItem: vi.fn(() => { throw new Error('x') }) }
    expect(() => writeAuthHint(roto, { initials: 'A', photoUrl: null })).not.toThrow()
    expect(() => clearAuthHint(roto)).not.toThrow()
    expect(() => writeAuthHint(null, { initials: 'A', photoUrl: null })).not.toThrow()
  })
})

describe('initialsOf', () => {
  it('toma las 2 primeras letras en mayúscula', () => {
    expect(initialsOf('juan@x.com')).toBe('JU')
  })
  it('sin correo → "U"', () => {
    expect(initialsOf(null)).toBe('U')
    expect(initialsOf(undefined)).toBe('U')
    expect(initialsOf('')).toBe('U')
  })
})
