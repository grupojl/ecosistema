# Contratos: SEO + idioma (ADR-016)

## 1. URLs públicas del storefront

| Path | Indexable | Comportamiento |
|------|-----------|----------------|
| `/{locale}/tienda/{slug}` | Si `locale` es primario de la tienda | 200 · `OnlineStore` JSON-LD |
| `/{locale}/tienda/{slug}/productos?page=N` | Ídem | 200 · N fuera de rango → **404** (no soft-404) |
| `/{locale}/tienda/{slug}/productos/{handle}` | Ídem | 200 · `Product` + `BreadcrumbList` |
| `/{locale}/tienda/{slug}/categoria/{handle}` | Ídem | 200 · `BreadcrumbList` |
| `/tienda/{slug}/...` | No (x-default) | **307** → `/{negociado}/tienda/{slug}/...` |
| `/sitemaps/{slug}` | — | `application/xml` · solo URLs indexables |
| `/robots.txt` | — | Disallow `/checkout`, `/tracking`, `/api/` |

`locale ∈ { 'es', 'pt', 'en' }` — fuente única: `real-ecommerce-front/lib/i18n/config.ts → LOCALES`.
Un primer segmento que no es locale ni ruta estática → 404 (`dynamicParams = false`).

## 2. Negociación de idioma (middleware, Edge)

**Entrada (request):**

| Señal | Origen | Prioridad |
|-------|--------|-----------|
| `Cookie: NEXT_LOCALE=pt` | Selector de idioma (elección explícita) | 1 |
| `Accept-Language` | Navegador | 2 |
| `X-Visitor-Country` → `CF-IPCountry` | Front / Cloudflare | 3 (ignorado si el UA es crawler) |
| — | `DEFAULT_LOCALE = 'es'` | 4 |

**Salida (response 307):**

```http
HTTP/1.1 307 Temporary Redirect
Location: /pt/tienda/mi-marca
Vary: Accept-Language, Cookie
Cache-Control: private, no-store
X-Locale-Source: accept-language
```

**Cookie de preferencia:** `NEXT_LOCALE={locale}; Path=/; Max-Age=31536000; SameSite=Lax`.
No es `HttpOnly` (la escribe el cliente) y no contiene datos sensibles.

## 3. `StoreInfo` (sass-back → ecommerce-back → storefront)

```typescript
interface StoreInfo {
  organizationId:   string          // uuid
  slug:             string
  name:             string | null
  description:      string | null
  logoUrl:          string | null
  website:          string | null
  countryCode:      string          // NUEVO (ADR-016) — ISO 3166-1 alpha-2, UPPERCASE
  ecommerceEnabled: boolean         // storeStatus === 'ACTIVE' (ADR-013)
}
```

- Cambio **aditivo**. ecommerce-back es *tolerant reader*: `countryCode`
  ausente o inválido → `'AR'` (valor default de `Organization.countryCode`).
- `GET /api/v1/organizations/public/by-slug/:slug` (sass-back, REST por ADR-005)
  **no** expone `userId`, `enabledProducts` ni `plan`.

## 4. Errores de `customer.resolveStore` / `customer.getProduct`

| Causa | Código tRPC | HTTP del storefront |
|-------|-------------|---------------------|
| Slug inexistente, tienda pausada, producto no publicado | `NOT_FOUND` | 404 |
| sass-back caído, timeout (5s), 5xx, contrato inválido, `SASS_BACK_URL` vacío | `SERVICE_UNAVAILABLE` | 5xx |
| Otro | `INTERNAL_SERVER_ERROR` | 5xx |

El storefront convierte en `null` **solo** `NOT_FOUND`. Todo lo demás se relanza.

## 5. Metadata por página

| Campo | Regla |
|-------|-------|
| `<html lang>` | = `locale` de la URL |
| `alternates.canonical` | URL absoluta self-referencial (mismo idioma, incluye `?page=N` si N > 1) |
| `alternates.languages` | Idiomas indexables + `x-default` (URL sin idioma) |
| `robots` | `index,follow` si el idioma es indexable; si no, `noindex,follow` |
| `openGraph.locale` | `{locale}_{countryCode}` (ej. `es_AR`) |
| `title` | Template de tienda: `%s · {store.name}` |

## 6. Variables de entorno

| Variable | Servicio | Tipo | Requerida | Uso |
|----------|----------|------|-----------|-----|
| `SITE_URL` | real-ecommerce-front | runtime | Sí (fail-soft) | Base de canonical, hreflang, sitemap |
| `SASS_BACK_URL` | realsass-ecommerce-back | runtime | Sí | Ya existente |

<!-- ADR-017-CONTRATOS -->
---

## 7. `Order.locale` (ADR-017)

Idioma de la sesión de compra, para que `notificaciones-backend` genere el
invoice/email de confirmación en el idioma correcto — no se adivina por
`visitorCountryCode` (país ≠ idioma, ver §2).

```typescript
interface CheckoutInput {
  // ...campos existentes (cartId, shippingAddress, shippingCents, visitorCountryCode)
  locale?: string   // NUEVO — validado en el router: 2 a 10 caracteres
}
```

- `Order.locale` es `String?` — nulo es válido. Pedidos históricos y
  canales sin storefront localizado no tienen este dato;
  `notificaciones-backend` debe tratar `null` como "usar el idioma default
  del sistema", nunca como error.
- El front lo completa automáticamente vía `useCheckout()` — resuelve
  explícito (si el caller lo pasa) > el último `/[locale]/` navegado
  (recordado en `stores/use-locale-store.ts`, alimentado por `<LocaleMemo>`
  en el layout de tienda) > `undefined` si no hay ninguno de los dos.
  Nunca inventa un valor.
- **Requiere HARD-05/06/07 resueltos** (ver `roadmap/deuda-tecnica.md`)
  para que `checkout()` ejecute — el campo está listo en el código desde
  ahora, no hace falta tocarlo de nuevo cuando eso pase.

## 8. Mapa mundial de países (ADR-017)

`lib/i18n/countries.ts` — 180 países → idioma ISO 639-1 dominante, separado
de `LOCALES` (los idiomas con diccionario activo). Ver ADR-017 D1.

```typescript
worldLanguageForCountry(countryCode: string | null | undefined): string | null
// País multilingüe (ver MULTILINGUAL_COUNTRIES) → null a propósito.
// País desconocido → null.
// País conocido con idioma real → el código ISO 639-1, exista o no su
// diccionario en LOCALES — ese filtro vive en config.ts, no acá.
```

`primaryLocaleForCountry()` (en `config.ts`) es quien decide qué hacer con
un idioma real-pero-inactivo: cae a `DEFAULT_LOCALE` y loguea con
`console.warn` (país + idioma faltante) — la señal de "activá este idioma".
