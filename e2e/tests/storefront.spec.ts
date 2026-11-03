/**
 * e2e del storefront en un navegador real contra el stack real (sass-back + ecommerce-back + Postgres sembrado).
 * Cubre DT-TEST-02 (smoke: home, productos, 404) y DT-STORE-UI-4 (la UI nunca se había abierto en un navegador).
 * Datos: e2e/setup/prepare.mjs → «Tienda E2E», 2 productos (uno sin stock).
 */
import { expect, test, type Page } from '@playwright/test';
import { STORE_SLUG } from '../setup/constants.mjs';

const home = `/es/${STORE_SLUG}`;

/** Falla el test si la página tira un error de JavaScript no capturado. */
function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return () => expect(errors, `Errores de JS en la página:\n${errors.join('\n')}`).toEqual([]);
}

test.describe('home de la tienda', () => {
  test('carga con la marca, los productos y sin errores de JS', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page);
    const res = await page.goto(home);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tienda E2E');
    await expect(page.getByText('Zapatilla Urbana').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    assertNoErrors();
  });

  test('no se desborda horizontalmente (celular y escritorio)', async ({ page }) => {
    await page.goto(home);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('tiene título y descripción para buscadores', async ({ page }) => {
    await page.goto(home);
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  });
});

test.describe('catálogo', () => {
  test('el listado muestra precio formateado y navega al detalle', async ({ page }) => {
    await page.goto(`${home}/productos`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Zapatilla Urbana').first()).toBeVisible();
    await expect(page.getByText(/15\.000/).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('NaN');

    await page.getByRole('link', { name: /Zapatilla Urbana/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`${home}/productos/zapatilla-urbana$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Zapatilla Urbana');
    await expect(page.getByText('Cómoda y liviana para todo el día.')).toBeVisible();
  });

  test('el detalle publica datos estructurados (JSON-LD) del producto', async ({ page }) => {
    await page.goto(`${home}/productos/zapatilla-urbana`);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = blocks.flatMap((b) => {
      const parsed = JSON.parse(b);
      return (Array.isArray(parsed) ? parsed : [parsed]).map((x: { '@type'?: string }) => x['@type']);
    });
    expect(types).toContain('Product');
  });

  test('la categoría lista sus productos', async ({ page }) => {
    const res = await page.goto(`${home}/categoria/calzado`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText('Zapatilla Urbana').first()).toBeVisible();
  });
});

test.describe('errores y 404 reales', () => {
  test('una tienda inexistente responde 404 (no 200 ni 500) con página de salida', async ({ page }) => {
    const res = await page.goto(`/es/no-existe-${Date.now()}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('link').first()).toBeVisible();
  });

  test('un producto inexistente responde 404', async ({ page }) => {
    const res = await page.goto(`${home}/productos/fantasma`);
    expect(res?.status()).toBe(404);
  });

  test('un idioma desconocido en la URL responde 404', async ({ page }) => {
    const res = await page.goto(`/xx/${STORE_SLUG}`);
    expect(res?.status()).toBe(404);
  });

  test('una página de listado fuera de rango es 404 real, no soft-404', async ({ page }) => {
    const res = await page.goto(`${home}/productos?page=99`);
    expect(res?.status()).toBe(404);
  });
});

test.describe('SEO', () => {
  test('/{slug} sin idioma redirige (307) a la URL con idioma; una URL con idioma nunca redirige', async ({ request }) => {
    const redirected = await request.get(`/${STORE_SLUG}`, { maxRedirects: 0 });
    expect(redirected.status()).toBe(307);
    expect(redirected.headers()['location']).toContain(`/es/${STORE_SLUG}`);

    const direct = await request.get(home, { maxRedirects: 0 });
    expect(direct.status()).toBe(200);
  });

  test('robots.txt responde', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/User-agent/i);
  });
});
