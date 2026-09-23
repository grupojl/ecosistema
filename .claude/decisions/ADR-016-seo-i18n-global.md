# ADR-016: SEO + idioma global del storefront

**Fecha:** 2026-09-22
**Estado:** Aceptado
**Autores:** Equipo GrupoJL
**Relacionado:** ADR-014 (Markets), ADR-005 (tRPC), ADR-007 (sin `any`), ADR-013 (storeStatus)

---

## Contexto

ADR-014 resolvió **dónde opera** una organización (Markets) y dejó explícitamente
fuera de alcance el idioma: *"Idioma por Market → Next.js i18n"*. Este ADR cierra
ese pendiente y define cómo el storefront público (`real-ecommerce-front`) se
posiciona en buscadores y habla el idioma del visitante.

Una auditoría del código (2026-09-22) mostró que, antes de hablar de SEO, el
storefront **no era indexable**. `ignoreBuildErrors: true` ocultaba estos bugs:

| # | Servicio | Bug | Efecto |
|---|----------|-----|--------|
| 1 | sass-back | `createForUserWithDefaultMarket` declarado fuera de la clase y sin `MarketsService` inyectado | No compila |
| 2 | sass-back | `findBySlug` lee `storeStatus` sin seleccionarlo | `ecommerceEnabled` siempre `false` → toda tienda en 404 |
| 3 | ecommerce-front | Caller tRPC vanilla invocado sin `.query()` | `resolveStore` siempre lanza → 404 |
| 4 | ecommerce-front | Páginas escritas contra un shape inexistente (`p.slug`, `p.priceCents`, `p.imageUrls`) | Precios "$NaN", links a `/productos/{uuid}` → 404 |
| 5 | ecommerce-front | `catch {}` → `null` en todo error | Caída de sass-back = 404 masivo = desindexación |
| 6 | ecommerce-front | `lib/store/index.ts` re-exporta `./types` inexistente | Build frágil |
| 7 | ecommerce-front | `<html lang="en">`, título "v0 App", sin canonical/hreflang/sitemap/JSON-LD | SEO nulo |

Además: **Railway no expone el país del visitante** (solo la región de Railway
más cercana). Cloudflare (`CF-IPCountry`) o Vercel (`x-vercel-ip-country`) sí.

---

## Decisión

### D1 — La URL lleva IDIOMA, no país

```
/{locale}/tienda/{slug}                         home de la tienda
/{locale}/tienda/{slug}/productos[?page=N]      listado
/{locale}/tienda/{slug}/productos/{handle}      detalle
/{locale}/tienda/{slug}/categoria/{handle}      categoría
/tienda/{slug}/...                              x-default: negocia y redirige (307)

locale ∈ { es, pt, en }
```

- **País → Market** (fulfillment, ADR-014) + formato regional de precio (`es-AR`, `pt-BR`).
- **Idioma → contenido y hreflang.**
- Mezclarlos en la URL (`es-AR`, `es-MX`, `es-CO`…) crea hasta 10 URLs casi
  idénticas por producto y por tienda sin contenido distinto: canibalización y
  crawl budget desperdiciado. Se revisa cuando existan precios por Market.

### D2 — Negociación automática del idioma (orden estricto)

```
1. Cookie NEXT_LOCALE      elección explícita del usuario → SIEMPRE gana
2. Accept-Language         mejor señal de IDIOMA (un brasileño en AR navega en pt)
3. País del visitante      solo si no hay Accept-Language y NO es un crawler
4. DEFAULT_LOCALE = es
```

- El país es una señal **débil** de idioma: nunca pisa a Accept-Language.
- Solo se redirigen URLs **sin** idioma (`/tienda/...`) con **307** (no 301: la
  negociación depende del visitante; un 301 lo cachea el navegador).
- Una URL **con** idioma (`/es/...`) **nunca** se redirige. Googlebot rastrea
  desde EE.UU.: redirigir por IP mandaría todo a `/en` y las demás variantes
  no se indexarían nunca.
- Respuesta de la negociación: `Vary: Accept-Language, Cookie`,
  `Cache-Control: private, no-store`, `X-Locale-Source: cookie|accept-language|country|default`.

### D3 — La UI se traduce para humanos; Google indexa solo contenido real

Traducir solo la UI (botones, menús) mientras nombre y descripción del producto
siguen en el idioma del dueño produce `/es` y `/en` casi duplicados: Google ignora
el hreflang y elige un canonical por su cuenta.

- **Idioma indexable** de la tienda = idioma primario derivado de
  `Organization.countryCode` (BR → pt · países hispanos → es · resto → es).
- Los demás idiomas: navegables, con `robots: noindex, follow`, **fuera** del sitemap.
- Fase 2 (`ProductTranslation`, patrón Shopify Translate & Adapt): un idioma pasa
  a indexable cuando tiene cobertura de traducción. Un solo punto de cambio:
  `lib/seo/indexing.ts → indexableLocalesForStore()`.

### D4 — Canonical y hreflang

- `canonical` **siempre self-referencial**. Nunca apunta a otro idioma.
- `hreflang` solo entre idiomas indexables + `x-default` → URL sin idioma.
- URLs absolutas desde `SITE_URL` (runtime, no `NEXT_PUBLIC`). Si falta: se
  **omiten** canonical/hreflang/sitemap y se loguea. Un canonical a `localhost`
  es peor que no tener canonical; tirar 500 en todas las tiendas, también.

### D5 — i18n sin dependencia nueva

Diccionarios TypeScript por idioma con `satisfies Dictionary` (falta una key →
no compila), `Intl.PluralRules` para plurales (reglas CLDR, no `n === 1`) e
interpolación `{var}`. 3 idiomas × ~2 KB no justifican `next-intl`.

**Disparador de revisión:** más de 5 idiomas, traductores externos o necesidad
de ICU / TMS (Crowdin, Lokalise) → migrar a `next-intl` en un ADR nuevo.

### D6 — Semántica de errores de punta a punta (importa para SEO)

| Situación | sass-back | ecommerce-back (tRPC) | storefront HTTP | Google |
|-----------|-----------|-----------------------|-----------------|--------|
| Slug no existe / tienda pausada | 404 / `ecommerceEnabled:false` | `NOT_FOUND` | **404** | Desindexa (correcto) |
| sass-back caído / timeout / contrato inválido | — | `SERVICE_UNAVAILABLE` | **5xx** | Reintenta y **conserva** el índice |

La respuesta de sass-back se valida con **Zod** en ecommerce-back (límite de
sistema), nunca con `as`.

### D7 — Datos estructurados (JSON-LD)

- Home de tienda → `OnlineStore`.
- Producto → `Product` + `Offer` (precio único) o `AggregateOffer` (rango),
  `availability` desde inventario (`quantityAvailable - quantityReserved`).
- Categoría / producto → `BreadcrumbList`.
- El nombre de producto es input del **tenant**: la serialización escapa
  `< > &` y `U+2028/2029` (XSS almacenado vía `</script>`).
- Rango de precio solo sobre una moneda: mezclar monedas es un dato falso.

### D8 — Sitemap y robots

- Sitemap **por tienda**: `/sitemaps/{slug}` con solo URLs indexables,
  `lastmod` desde `Product.updatedAt` y `xhtml:link` hreflang. Tope 50.000 URLs.
- `robots.txt`: `Disallow: /checkout, /tracking, /api/`.
- Sin sitemap index global (no hay procedure que liste tiendas públicas) → Fase 2.

### D9 — Detección de país

`X-Visitor-Country` (explícito) → `CF-IPCountry` → sin país.
Requiere **Cloudflare proxied** delante del dominio del storefront. Sin él, la
negociación sigue funcionando por cookie + Accept-Language (que es la señal
principal de idioma). MaxMind GeoIP en proceso: descartado por ahora (licencia,
actualización de la base, +MB en la imagen).

---

## Alternativas descartadas

- **ccTLD por país** (`tienda.com.ar`, `.com.br` — modelo Mercado Libre): excelente
  señal geográfica, pero un dominio por país × tenant es inviable en un SaaS.
- **Subdominio por idioma** (`es.tienda.com` — modelo Wikipedia): certificados,
  cookies y DNS se complican en multi-tenant; subcarpetas consolidan autoridad.
- **País + idioma en la URL** (`/es-ar/` — modelo Shopify Markets / IKEA): correcto
  cuando precio/catálogo cambian por país. Hoy no cambian (Stripe hace multi-moneda,
  ADR-014) → solo duplicaría URLs. Se reevalúa con precios por Market.
- **Cookie sin cambio de URL**: Google no puede indexar una variante sin URL propia.
- **`?lang=es`**: señal débil, fácil de duplicar, parámetros ignorados por crawlers.
- **Redirigir SIEMPRE por IP**: contrario a las guías de Google; rompe la
  indexación de variantes y frustra a viajeros y expatriados.
- **`next-intl` desde el día 1**: ver D5.

---

## Consecuencias

### Positivas
- Productos indexables por primera vez (bugs 1-7 resueltos como prerequisito).
- Rich results de precio y stock en Google.
- El visitante ve la UI en su idioma sin hacer nada; si elige otro, se respeta siempre.
- Agregar un idioma = un diccionario + una entrada en `LOCALES`. Sin tocar páginas.
- Una caída de un backend ya no desindexa tiendas.

### Negativas / riesgos
- **Cambio de URLs**: `/tienda/...` pasa a `/{locale}/tienda/...`. Las viejas
  redirigen (307), pero hay que reenviar sitemaps en Search Console.
- Sin imágenes en el modelo `Product` → rich results sin imagen (menos CTR).
- Sin Cloudflare, la señal país no existe (degradación aceptable, ver D9).
- Root layouts múltiples (`app/[locale]` y `app/(site)`): navegar entre ambos
  es full reload.

### Pendiente consciente (fuera de este ADR)
- `ProductTranslation` + idiomas indexables por cobertura (Fase 2).
- Imágenes de producto (bloquea rich results completos).
- Sitemap index global + procedure `customer.listPublicStores`.
- Dominios propios por tenant (canonical por host).
- `order.locale` → emails (notificaciones-backend) y checkout de proveedores
  (pasarelapagos-backend) en el idioma del comprador — **ecosistema-ms**.
- Quitar `ignoreBuildErrors` del storefront.

---

## Referencias

- Norte: `.claude/architecture/10-seo-i18n-norte.md`
- Contratos: `.claude/contracts/seo-i18n.md`
- Checklists: `.claude/modules/{sass-back,ecommerce-back,ecommerce-front}/seo-i18n.md`
- Release: `.claude/checklists/seo-i18n-release.md`
- Estado: `.claude/decisions/ADR-016-seo-i18n-status.md`
