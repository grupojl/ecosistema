# ADR-022: URLs limpias — panel en la raíz y tiendas en /{idioma}/{slug}

**Fecha:** 2026-10-16
**Estado:** Aceptado — implementado en `realsass-dashboard-front` y `real-ecommerce-front`
**Enmienda:** ADR-016 (estructura de URL `/{es|pt|en}/tienda/{slug}/…`) y `contracts/seo-i18n.md`

## Contexto

- El panel de colaboradores vivía en `localhost:3022/dashboard/…`. El puerto/dominio ya identifica al panel: el prefijo
  `/dashboard` era ruido.
- Las tiendas vivían en `/{locale}/tienda/{slug}/…`. El segmento `/tienda/` no aporta: el dominio ya es de tiendas.
- Pregunta frecuente: lo que va después de `/tienda/` es el **slug** de la organización (`organizations.slug`, p. ej.
  `tienda-de-agustin-jalil-leon-9779` = nombre + 4 dígitos al azar, único y público), **no** un UUID. El UUID
  (`organizationId`) es interno y no aparece en ninguna URL.

## Decisión

1. **Panel:** `/dashboard/**` pasa a `/**` (carpeta `app/(panel)`, un grupo de rutas que no aparece en la URL).
   `/` es el inicio del panel; `/login` y `/auth/sso` siguen igual.
   `/dashboard/**` → `/**` con **308** (marcadores e historial).
2. **Tiendas:** `/{locale}/tienda/{slug}/…` pasa a `/{locale}/{slug}/…` (`app/[locale]/[slug]`).
   `/{locale}/tienda/{slug}/…` → `/{locale}/{slug}/…` con **308** (Google transfiere el posicionamiento).
3. **Entrada sin idioma** (el `x-default` de hreflang y los links compartidos): `/{slug}/…` — y el prefijo viejo
   `/tienda/{slug}/…` — responden **307** a `/{idioma negociado}/{slug}/…`. Sigue siendo 307 (la negociación depende del
   visitante) y las URLs con idioma nunca se redirigen.
4. El matcher del proxy excluye las rutas fijas (`/checkout`, `/tracking`, `/categoria/…`, `/products/…`, `/sitemaps/…`,
   `/robots.txt`, archivos, `_next`, `api`) y los idiomas. Next exige un literal, así que se mantiene a mano; un test
   (`lib/i18n/store-path.spec.ts`) falla si falta un idioma, una ruta fija o aparece una carpeta nueva en `app/`.
5. El panel enlaza a la tienda como `${STORE_FRONT_URL}/${slug}` (el storefront elige el idioma).

## Alternativas descartadas

- **Dejar `/tienda/`** — es lo que se pidió quitar; solo agrega un segmento.
- **Slug sin idioma (`/{slug}`) como URL canónica** — rompe ADR-016 (idioma en la URL, hreflang por variante).
- **Subdominio por tienda (`{slug}.dominio.com`)** — es la evolución natural, pero exige DNS comodín y resolver la tienda
  por host; no se justifica hoy. La estructura `/{locale}/{slug}` no lo impide.

## Consecuencias

**Se gana:** URLs más cortas y legibles; el slug es lo único que identifica a la tienda.

**Riesgos / deuda consciente:**
- Un slug que coincida con una ruta fija del storefront (`checkout`, `tracking`…) quedaría tapado. Los slugs se generan con
  sufijo numérico, así que no ocurre; si se permitieran slugs a medida habrá que reservar esos nombres (DT-URL-1).
- Cualquier ruta nueva en `app/` del storefront debe sumarse al matcher del proxy (lo vigila el test).
- El slug sigue conteniendo "tienda-de-…" cuando el nombre de la organización empieza así: sale del nombre, no del código.
- `/foo/bar` (ruta inexistente sin idioma) ahora redirige a `/es/foo/bar` y termina en 404 en vez de 404 directo.
- El `canonical`/`hreflang`/sitemap ya salen con la URL nueva; las URLs viejas con idioma ya indexadas (ninguna en producción
  todavía) se transfieren por el 308.

## Referencias

- `real-ecommerce-front/proxy.ts` · `lib/i18n/store-path.ts` · `next.config.mjs` (`redirects`)
- `realsass-dashboard-front/next.config.mjs` (`redirects`) · `app/(panel)/`
- ADR-016 · `contracts/seo-i18n.md` · `architecture/10-seo-i18n-norte.md`
