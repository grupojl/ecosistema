import { describe, expect, it, afterEach } from 'vitest'
import {
  compareVersions,
  detectOs,
  evaluateVersion,
  parseVersion,
  readConsent,
  writeConsent,
  getDesktopBridge,
  isValidChallenge,
  isValidCode,
  isValidLoopbackPort,
  isValidState,
  isValidVerifier,
  loopbackCallbackUrl,
  loopbackStartUrl,
  parsePort,
  safeNextPath,
} from '@/lib/desktop'

const HEX64 = 'a'.repeat(64)
const CODE = 'AbC-_123'.repeat(6) // 48 caracteres base64url

describe('puerto de loopback', () => {
  it('acepta solo puertos efímeros', () => {
    expect(isValidLoopbackPort(51234)).toBe(true)
    expect(isValidLoopbackPort(1024)).toBe(true)
    expect(isValidLoopbackPort(65535)).toBe(true)
    for (const bad of [80, 1023, 65536, 0, -1, 1.5, '5000', null, undefined, NaN]) {
      expect(isValidLoopbackPort(bad)).toBe(false)
    }
  })

  it('parsePort lee solo dígitos y valida el rango', () => {
    expect(parsePort('51234')).toBe(51234)
    expect(parsePort('51234abc')).toBeNull()
    expect(parsePort('99999')).toBeNull()
    expect(parsePort('0080')).toBeNull()
    expect(parsePort('')).toBeNull()
    expect(parsePort(null)).toBeNull()
  })
})

describe('state, challenge, verifier y código', () => {
  it('state: caracteres seguros y largo razonable', () => {
    expect(isValidState(HEX64)).toBe(true)
    expect(isValidState('a'.repeat(16))).toBe(true)
    expect(isValidState('corto')).toBe(false)
    expect(isValidState('a'.repeat(129))).toBe(false)
    expect(isValidState('aaaaaaaaaaaaaaa!')).toBe(false)
    expect(isValidState(null)).toBe(false)
  })

  it('challenge y verifier: exactamente 64 hex en minúscula', () => {
    for (const fn of [isValidChallenge, isValidVerifier]) {
      expect(fn(HEX64)).toBe(true)
      expect(fn('A'.repeat(64))).toBe(false)
      expect(fn('a'.repeat(63))).toBe(false)
      expect(fn('a'.repeat(65))).toBe(false)
      expect(fn('g'.repeat(64))).toBe(false)
      expect(fn(null)).toBe(false)
    }
  })

  it('código: base64url de 32 a 128 caracteres', () => {
    expect(isValidCode(CODE)).toBe(true)
    expect(isValidCode('a'.repeat(31))).toBe(false)
    expect(isValidCode('a'.repeat(129))).toBe(false)
    expect(isValidCode(`${'a'.repeat(40)}&x=1`)).toBe(false)
    expect(isValidCode(`${'a'.repeat(40)}.`)).toBe(false)
    expect(isValidCode('')).toBe(false)
  })
})

describe('URLs de loopback', () => {
  it('el callback lleva el CÓDIGO (nunca un token) y escapa los valores', () => {
    const url = loopbackCallbackUrl(51234, HEX64, CODE)
    expect(url).toBe(`http://127.0.0.1:51234/callback?state=${HEX64}&code=${CODE}`)
    expect(url).not.toContain('token')
    expect(loopbackCallbackUrl(51234, 'a b', 'c&d')).toContain('state=a%20b&code=c%26d')
  })

  it('siempre apunta a 127.0.0.1', () => {
    expect(new URL(loopbackCallbackUrl(5000, HEX64, CODE)).hostname).toBe('127.0.0.1')
    expect(loopbackStartUrl(5000)).toBe('http://127.0.0.1:5000/start')
  })
})

describe('safeNextPath (redirect abierto)', () => {
  it('deja pasar solo rutas internas', () => {
    expect(safeNextPath('/tienda/pedidos?x=1')).toBe('/tienda/pedidos?x=1')
    for (const bad of ['//evil.com', 'https://evil.com', String.raw`/\evil.com`, 'tienda', '', null, undefined]) {
      expect(safeNextPath(bad as string | null | undefined)).toBe('/')
    }
  })
})

describe('getDesktopBridge', () => {
  const g = globalThis as unknown as { window?: unknown }
  afterEach(() => { delete g.window })

  it('null fuera del navegador o sin puente inyectado', () => {
    expect(getDesktopBridge()).toBeNull()
    g.window = {}
    expect(getDesktopBridge()).toBeNull()
  })

  it('devuelve el puente válido y descarta puertos inválidos', () => {
    g.window = { __WELVER_DESKTOP__: { loginPort: 51234, version: '0.1.0' } }
    expect(getDesktopBridge()).toEqual({ loginPort: 51234, version: '0.1.0' })
    g.window = { __WELVER_DESKTOP__: { loginPort: 80, version: '0.1.0' } }
    expect(getDesktopBridge()).toBeNull()
    g.window = { __WELVER_DESKTOP__: { loginPort: 51234 } }
    expect(getDesktopBridge()).toEqual({ loginPort: 51234, version: '' })
  })
})

describe('política de versiones (DT-DESK-11)', () => {
  it('parseVersion solo acepta x.y.z', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3])
    for (const bad of ['1.2', 'v1.2.3', '1.2.3-beta', '', null, undefined]) expect(parseVersion(bad)).toBeNull()
  })

  it('compareVersions ordena numéricamente (no como texto)', () => {
    expect(compareVersions('0.9.0', '0.10.0')).toBeLessThan(0)
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('basura', '0.1.0')).toBeLessThan(0)
  })

  const policy = { minVersion: '0.2.0', blockedVersions: ['0.3.1'], downloadUrl: null }

  it('por debajo de la mínima pide actualizar; igual o superior pasa', () => {
    expect(evaluateVersion('0.1.9', policy)).toBe('update-required')
    expect(evaluateVersion('0.2.0', policy)).toBe('ok')
    expect(evaluateVersion('0.10.0', policy)).toBe('ok')
  })

  it('una versión bloqueada gana aunque supere la mínima (el "rollback")', () => {
    expect(evaluateVersion('0.3.1', policy)).toBe('blocked')
    expect(evaluateVersion('0.3.2', policy)).toBe('ok')
  })

  it('sin política o con versión ilegible NO bloquea a nadie (un fallo de red no puede dejar a todos sin panel)', () => {
    expect(evaluateVersion('0.1.0', null)).toBe('ok')
    expect(evaluateVersion('0.1.0', undefined)).toBe('ok')
    expect(evaluateVersion('', policy)).toBe('ok')
    expect(evaluateVersion('0.1.0', { minVersion: null, blockedVersions: [], downloadUrl: null })).toBe('ok')
  })
})

describe('consentimiento y sistema operativo (DT-DESK-13)', () => {
  const memory = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }

  it('sin respuesta guardada no hay consentimiento (se pregunta)', () => {
    expect(readConsent(memory())).toBeNull()
    expect(readConsent(null)).toBeNull()
  })

  it('guarda y lee granted/denied; ignora cualquier otro valor', () => {
    const s = memory()
    writeConsent(s, 'granted')
    expect(readConsent(s)).toBe('granted')
    writeConsent(s, 'denied')
    expect(readConsent(s)).toBe('denied')
    s.setItem('welver.desktop.telemetry', 'yes')
    expect(readConsent(s)).toBeNull()
  })

  it('si el almacenamiento falla no rompe y se vuelve a preguntar', () => {
    const roto = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(readConsent(roto)).toBeNull()
    expect(() => writeConsent(roto, 'granted')).not.toThrow()
  })

  it('detectOs', () => {
    expect(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('macos')
    expect(detectOs('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
    expect(detectOs('algo raro')).toBe('unknown')
    expect(detectOs(null)).toBe('unknown')
  })
})
