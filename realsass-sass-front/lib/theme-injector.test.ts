import { describe, expect, it } from 'vitest'
import { buildThemeCSS, safeCssToken, safeCustomCss } from './theme-injector'
import type { PublicTheme } from './config-client'

const theme = (over: Partial<PublicTheme> = {}): PublicTheme => ({
  id: 't', name: 'T', primaryColor: null, secondaryColor: null, accentColor: null, fontFamily: null, borderRadius: null,
  logoUrl: null, faviconUrl: null, darkMode: false, customCSS: null, isSystemDefault: false, isActive: true, ...over,
})

describe('buildThemeCSS', () => {
  it('un tema sin personalización no genera nada (se usa el del sistema)', () => {
    expect(buildThemeCSS(theme())).toBe('')
  })

  it('genera las custom properties de un tema legítimo', () => {
    const css = buildThemeCSS(theme({ primaryColor: '#1a73e8', secondaryColor: 'rgb(10, 20, 30)', accentColor: 'hsl(210 50% 40%)', fontFamily: "Inter, 'Open Sans'", borderRadius: '0.5rem' }))
    expect(css).toContain('--color-primary: #1a73e8;')
    expect(css).toContain('--color-secondary: rgb(10, 20, 30);')
    expect(css).toContain('--font-sans: Inter, \'Open Sans\', sans-serif;')
    expect(css).toContain('--radius: 0.5rem;')
    expect(css.startsWith(':root {')).toBe(true)
  })

  it('agrega el CSS libre después de las variables', () => {
    const css = buildThemeCSS(theme({ primaryColor: '#fff', customCSS: '.hero { color: red; }' }))
    expect(css.indexOf(':root')).toBeLessThan(css.indexOf('.hero'))
  })

  it('con solo CSS libre no emite un :root vacío', () => {
    expect(buildThemeCSS(theme({ customCSS: 'a{b:c}' }))).toBe('a{b:c}')
  })
})

describe('seguridad: el dueño no puede inyectar HTML ni romper el bloque', () => {
  const attacks = [
    'red;}</style><script>alert(1)</script>',
    '#fff;} body{display:none',
    'url(https://evil.example/x.png)',
    'expression(alert(1))',
    'red; background: url(javascript:alert(1))',
    '</style>',
    'a\\3c script',
    'x'.repeat(500),
  ]

  it.each(attacks)('descarta el valor peligroso %#', (attack) => {
    expect(safeCssToken(attack)).toBeNull()
    const css = buildThemeCSS(theme({ primaryColor: attack, fontFamily: attack, borderRadius: attack }))
    expect(css).toBe('')
  })

  it('el CSS libre nunca contiene "<" (no puede cerrar el <style>)', () => {
    const css = buildThemeCSS(theme({ customCSS: 'a{}</style><script>alert(1)</script><style>b{}' }))
    expect(css).not.toContain('<')
    expect(css).not.toMatch(/<\/style/i)
    expect(safeCustomCss(null)).toBe('')
  })

  it('un valor inválido no arrastra a los válidos', () => {
    const css = buildThemeCSS(theme({ primaryColor: '</style>', accentColor: '#abc' }))
    expect(css).toContain('--color-accent: #abc;')
    expect(css).not.toContain('--color-primary')
  })
})
