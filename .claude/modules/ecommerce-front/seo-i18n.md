# ecommerce-front — SEO + idioma (ADR-016)

**Rol:** DETECTOR de idioma y país (ya era detector de país en ADR-014) y única
superficie indexable del ecosistema.

## Mapa de archivos

```
real-ecommerce-front/
├── middleware.ts                         negociación de idioma (Edge) — solo /tienda/*
├── app/
│   ├── [locale]/                         root layout con <html lang={locale}>
│   │   ├── layout.tsx                    dynamicParams=false · metadataBase
│   │   └── tienda/[slug]/                (movido desde app/tienda)
│   │       ├── layout.tsx                header + LocaleSwitcher + title template
│   │       ├── page.tsx                  OnlineStore JSON-LD
│   │       ├── productos/page.tsx        paginación real (404 fuera de rango)
│   │       ├── productos/[handle]/page.tsx   Product + Offer + Breadcrumb
│   │       └── categoria/[categoria]/page.tsx
│   ├── (site)/                           root layout legacy (checkout, tracking, …)
│   ├── sitemaps/[slug]/route.ts          sitemap por tienda
│   └── robots.ts
├── lib/
│   ├── i18n/  config · negotiate · index (t, plural) · dictionaries/{types,es,pt,en}
│   ├── seo/   site (canonical/hreflang) · indexing · json-ld · sitemap
│   ├── catalog/product-view.ts           mapeo contra el contrato REAL
│   └── store/ resolver · client · index  (cache() + .query() + NOT_FOUND vs 5xx)
└── components/
    ├── seo/json-ld.tsx
    └── storefront/ product-card · locale-switcher
```

## Checklist

### i18n
- [x] **SEO-EF-01** — `lib/i18n/config.ts`: `LOCALES`, `isLocale`, país→idioma (solo
      países con idioma inequívoco), `primaryLocaleForCountry`, `intlLocale`, `openGraphLocale`.
- [x] **SEO-EF-02** — `lib/i18n/negotiate.ts` (puro): `parseAcceptLanguage` (q-values,
      orden estable, tope 512 chars), `matchLocale`, `isLikelyCrawler`, `negotiateLocale`.
- [x] **SEO-EF-03** — Diccionarios `es/pt/en` con `satisfies Dictionary`; `t()` y
      `plural()` con `Intl.PluralRules`.
- [x] **SEO-EF-04** — `middleware.ts`: matcher `['/tienda', '/tienda/:path*']`, 307,
      `Vary`, `Cache-Control: private, no-store`, `X-Locale-Source`.
      ⚠️ Si ya existe un `middleware.ts`, **componer**, no sobrescribir.
- [x] **SEO-EF-05** — `LocaleSwitcher`: `<a hrefLang>` real (funciona sin JS) +
      cookie `NEXT_LOCALE` solo en elección explícita.

### Routing
- [x] **SEO-EF-06** — `git mv app/tienda 'app/[locale]/tienda'`.
- [x] **SEO-EF-07** — Rutas legacy a `app/(site)/` (layout, page, checkout, tracking,
      products, categoria); `import '../globals.css'`. Abortar si hay otras rutas
      en `app/` sin root layout.
- [x] **SEO-EF-08** — `app/[locale]/layout.tsx`: `<html lang>`, providers,
      `generateStaticParams` + `dynamicParams = false`.

### Datos (bugs bloqueantes)
- [x] **SEO-EF-09** — `lib/store/resolver.ts` y `client.ts`: `.query()`, `React.cache()`,
      `null` solo en `NOT_FOUND`, relanzar el resto.
- [x] **SEO-EF-10** — `lib/store/index.ts`: quitar `export * from './types'`.
- [x] **SEO-EF-11** — `lib/catalog/product-view.ts`: precio min/max por moneda,
      stock = `available - reserved`, `formatPrice` tolerante a moneda inválida,
      `paginate` (fuera de rango → null → 404).
- [x] **SEO-EF-12** — Reescribir las 4 páginas de tienda contra el contrato real,
      links con `/{locale}/…`, sin textos hardcodeados.
- [x] **SEO-EF-13** — Eliminar `productos-view.tsx` (código muerto, fetch client-side
      invisible para crawlers).

### SEO
- [x] **SEO-EF-14** — `lib/seo/site.ts`: `SITE_URL` fail-soft, `buildAlternates`
      (canonical self + hreflang indexables + x-default), `robotsFor`.
- [x] **SEO-EF-15** — `lib/seo/indexing.ts`: `indexableLocalesForStore` = idioma primario.
- [x] **SEO-EF-16** — `lib/seo/json-ld.ts` + `<JsonLd>`: OnlineStore, Product,
      Offer/AggregateOffer, BreadcrumbList, `serializeJsonLd` con escape anti-XSS.
- [x] **SEO-EF-17** — `app/sitemaps/[slug]/route.ts` + `lib/seo/sitemap.ts`
      (escape XML, tope 50k, `xhtml:link`, `Cache-Control: public, s-maxage=3600`).
- [x] **SEO-EF-18** — `app/robots.ts`.

### Tests y config
- [x] **SEO-EF-19** — Vitest (`vitest: catalog:`) sobre todo lo puro: negotiate,
      config, t/plural, product-view, site, json-ld (incluye caso `</script>`), sitemap.
      Cobertura ≥ 85% en `lib/i18n`, `lib/seo`, `lib/catalog`.
- [x] **SEO-EF-20** — `SITE_URL` en Railway. `ignoreBuildErrors` se quita en DT-SEO-07,
      no en este cambio (romperíamos el build por errores ajenos a ADR-016).

## Verificación

```bash
pnpm --filter real-ecommerce-front exec vitest run --coverage
pnpm --filter real-ecommerce-front exec tsc --noEmit 2>&1 \
  | grep -E '^(lib/(i18n|seo|catalog|store)|app/\[locale\]|middleware|components/(seo|storefront))' \
  || echo "0 errores en archivos de ADR-016"
```

## Deploy

Tercero, con `SITE_URL` ya configurado. Luego `checklists/seo-i18n-release.md`.

<!-- ADR-017-EXTENSION -->
---

## Extensión — mundial + RTL + Order.locale (ADR-017, 2026-09-22)

- [x] **EF-21** — `lib/i18n/countries.ts`: mapa de 180 países → idioma dominante
- [x] **EF-22** — `LOCALES` ampliado a 5 activos: es/pt/en/fr/de
- [x] **EF-23** — `RTL_LOCALES` + `isRtlLocale()` + `<html dir>` en el layout — arquitectura lista, vacío a propósito
- [x] **EF-24** — `primaryLocaleForCountry()`: `console.warn` accionable cuando un país tiene idioma real sin diccionario activo
- [x] **EF-25** — `categoria/[categoria]/page.tsx`: `generateMetadata` propio (antes heredaba el canonical de la home — bug real de indexación)
- [x] **EF-26** — categorías agregadas al sitemap
- [x] **EF-27** — `stores/use-locale-store.ts` + `<LocaleMemo>` + `resolveCheckoutLocale()` + `useCheckout()` — Order.locale de punta a punta
- [x] **EF-28** — `vitest.config.ts` + suite completa: 99/99 tests, ~99% cobertura

## Verificación

```bash
pnpm --filter real-ecommerce-front exec vitest run --coverage
pnpm --filter real-ecommerce-front exec tsc --noEmit
```

`tsc` va a seguir fallando hasta que se resuelvan HARD-03/04/08/09 de
`roadmap/deuda-tecnica.md` — ninguno de esos archivos es de este módulo.
