/**
 * middleware.ts — real-ecommerce-front (Edge)
 *
 * Solo intercepta URLs de tienda SIN idioma (/tienda/...). Las URLs con
 * idioma (/es/tienda/...) nunca se redirigen: son las que Google indexa y
 * redirigirlas según IP/idioma del visitante impediría indexar las variantes
 * (Googlebot rastrea desde EE.UU. → todo terminaría en /en).
 *
 * 307 (no 301): la negociación depende del visitante; un 301 lo cachearía
 * el navegador y "congelaría" el idioma.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE } from '@/lib/i18n/config';
import { negotiateLocale } from '@/lib/i18n/negotiate';
import { resolveVisitorCountry } from '@/lib/market/resolver';

export function middleware(request: NextRequest): NextResponse {
  const country = resolveVisitorCountry(request);

  const { locale, source } = negotiateLocale({
    cookieLocale:   request.cookies.get(LOCALE_COOKIE)?.value ?? null,
    acceptLanguage: request.headers.get('accept-language'),
    countryCode:    country === 'default' ? null : country,
    userAgent:      request.headers.get('user-agent'),
  });

  const target = request.nextUrl.clone();
  target.pathname = `/${locale}${request.nextUrl.pathname}`;

  const response = NextResponse.redirect(target, 307);
  response.headers.set('Vary', 'Accept-Language, Cookie');
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Locale-Source', source); // observabilidad: qué señal decidió
  return response;
}

export const config = {
  matcher: ['/tienda', '/tienda/:path*'],
};
