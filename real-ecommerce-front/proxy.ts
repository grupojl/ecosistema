/**
 * proxy.ts — real-ecommerce-front (Next 16: convención `proxy`, antes `middleware`; runtime Node.js)
 *
 * Solo intercepta URLs de tienda SIN idioma: /{slug}/… y el prefijo viejo /tienda/{slug}/… (ADR-022). Las URLs con
 * idioma (/es/{slug}/…) nunca se redirigen: son las que Google indexa y redirigirlas según IP/idioma del visitante
 * impediría indexar las variantes (Googlebot rastrea desde EE.UU. → todo terminaría en /en).
 *
 * 307 (no 301): la negociación depende del visitante; un 301 lo cachearía el navegador y "congelaría" el idioma.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE } from '@/lib/i18n/config';
import { negotiateLocale } from '@/lib/i18n/negotiate';
import { storePathWithLocale } from '@/lib/i18n/store-path';
import { resolveVisitorCountry } from '@/lib/market/resolver';

export function proxy(request: NextRequest): NextResponse {
  const country = resolveVisitorCountry(request);

  const { locale, source } = negotiateLocale({
    cookieLocale:   request.cookies.get(LOCALE_COOKIE)?.value ?? null,
    acceptLanguage: request.headers.get('accept-language'),
    countryCode:    country === 'default' ? null : country,
    userAgent:      request.headers.get('user-agent'),
  });

  const target = request.nextUrl.clone();
  target.pathname = storePathWithLocale(request.nextUrl.pathname, locale);

  const response = NextResponse.redirect(target, 307);
  response.headers.set('Vary', 'Accept-Language, Cookie');
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Locale-Source', source); // observabilidad: qué señal decidió
  return response;
}

/**
 * Todo lo que NO es una ruta fija ni empieza con un idioma. Next exige que el matcher sea un literal (no admite
 * constantes importadas): si se agrega un idioma en LOCALES o una ruta fija en app/, hay que sumarlo acá
 * (lo vigila lib/i18n/store-path.spec.ts).
 */
export const config = {
  matcher: [
    '/((?!_next/|_vercel/|api/|sitemaps(?:/|$)|categoria/|products/|checkout(?:/|$)|tracking(?:/|$)|robots\\.txt$|sitemap|favicon|icon|apple-icon|images/|(?:es|pt|en|fr|de)(?:/|$)|.*\\..*).+)',
  ],
};
