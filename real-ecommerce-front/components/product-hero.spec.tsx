import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductHero from '@/components/product-hero'

describe('ProductHero', () => {
  it('tienda: botones con destino real y fondo alternado según darkBg', () => {
    const html = renderToStaticMarkup(
      <ProductHero
        darkBg
        title="Zapatilla Urbana"
        subtitle="Calzado · $ 10.000"
        description="Cómoda"
        noImageLabel="Sin imagen"
        primary={{ label: 'Conocer más', href: '/es/x/productos/zapatilla-urbana' }}
        secondary={{ label: 'Ver todos', href: '/es/x/productos' }}
      />,
    )
    expect(html).toContain('bg-muted/50')
    expect(html).toContain('href="/es/x/productos/zapatilla-urbana"')
    expect(html).toContain('href="/es/x/productos"')
    expect(html).toContain('Sin imagen')
    expect(html).not.toContain('href="#"')
  })

  it('nunca fuerza el modo oscuro (la persona elige el tema)', () => {
    const html = renderToStaticMarkup(<ProductHero darkBg={false} title="T" subtitle="S" primary={{ label: 'A', href: '/a' }} />)
    expect(html).not.toMatch(/class="[^"]*dark/)
  })

  it('sin imagen ni placeholder no renderiza el bloque de imagen', () => {
    const html = renderToStaticMarkup(<ProductHero darkBg title="T" subtitle="S" />)
    expect(html).not.toContain('aspect-square')
  })

  it('home genérica (compatibilidad): sigue aceptando `buttons` e imagen', () => {
    const html = renderToStaticMarkup(
      <ProductHero darkBg={false} title="Aurora" subtitle="s" image="/placeholder.svg" buttons={['Conocer más', 'Comprar']} />,
    )
    expect(html).toContain('Conocer más')
    expect(html).toContain('Comprar')
    expect(html).toContain('src="/placeholder.svg"')
  })
})
