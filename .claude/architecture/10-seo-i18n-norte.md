# 10 — Norte: SEO + idioma global

> Los referentes mundiales que resolvieron "un sitio, muchos países, muchos
> idiomas" y qué tomamos de cada uno. Leer antes de tocar routing, metadata,
> middleware o traducciones del storefront. Decisión formal: ADR-016.

## El norte en una línea

**Shopify Markets** (estructura) · **Apple** (no forzar) · **Airbnb / Booking** (el usuario manda) ·
**IKEA** (idioma ≠ país) · **Mercado Libre** (LatAm primero) · **Google Search Central** (las reglas del juego)

**Principio unificador:** *el sistema sugiere, el usuario decide, Google ve siempre la misma URL para el mismo contenido.*

---

## 1. Shopify Markets — la estructura

**Qué resolvieron:** miles de tiendas multi-tenant vendiendo en muchos países
con el mismo backend. Mercados como entidad de dominio, idiomas en subcarpetas
del mismo dominio, hreflang generado automáticamente, y traducciones de contenido
(Translate & Adapt) separadas de la UI.

**Qué adoptamos:**
- Subcarpetas en el mismo dominio (`/es/`, `/pt/`) → la autoridad SEO se consolida.
- hreflang generado por el sistema, nunca a mano por el dueño.
- La traducción de CONTENIDO es una entidad aparte (Fase 2: `ProductTranslation`).
- Market ≠ idioma (ya adoptado en ADR-014).

**Qué NO copiamos (todavía):** país+idioma en la URL (`/en-us/`). Tiene sentido
cuando cambia el precio o el catálogo por país; hoy no cambian.

**Señal de cumplimiento:** agregar un idioma no requiere tocar ninguna página.

---

## 2. Apple — sugerir, no forzar

**Qué resolvieron:** un visitante en el "país equivocado" (viajero, VPN,
expatriado). Apple muestra una sugerencia para ir a la versión de tu país en vez
de redirigirte a la fuerza.

**Qué adoptamos:**
- Una URL con idioma **nunca** se redirige.
- `MarketBanner` (ADR-014) sugiere; no redirige.

**Señal de cumplimiento:** `curl -I -A Googlebot https://…/pt/tienda/x` → `200`, jamás `3xx`.

---

## 3. Airbnb / Booking.com — la preferencia del usuario manda

**Qué resolvieron:** idioma y moneda como preferencias **independientes** y
persistentes. La primera visita se infiere del navegador; después, lo que elegiste.

**Qué adoptamos:**
- Orden de negociación: **cookie explícita > Accept-Language > país > default**.
- Solo el selector de idioma escribe la cookie `NEXT_LOCALE`; la inferencia nunca.
- Idioma (URL) desacoplado de moneda/región (Market + `Intl`).

**Señal de cumplimiento:** un usuario que eligió `pt` sigue en `pt` aunque su
navegador diga `es` y esté en Argentina.

---

## 4. IKEA — idioma ≠ país

**Qué resolvieron:** países multilingües (Canadá en/fr, Suiza de/fr/it). Su URL
lleva país **y** idioma porque el país no determina el idioma.

**Qué adoptamos:**
- La tabla país → idioma solo incluye países con idioma dominante inequívoco.
  Países multilingües no se mapean: ahí decide Accept-Language.
- Accept-Language pesa más que la IP.

**Señal de cumplimiento:** un visitante de Canadá con navegador en francés no
cae en `en` por su IP.

---

## 5. Mercado Libre — LatAm primero

**Qué resolvieron:** el e-commerce dominante de la región con dominio por país
(`.com.ar`, `.com.mx`, `.com.br`) y español/portugués como idiomas de primera clase.

**Qué adoptamos:**
- `es` y `pt` son los idiomas principales; `en` es secundario.
- Formato regional real en precios (`es-AR`, `pt-BR`) vía `Intl`, no strings a mano.
- Plurales con reglas CLDR (`Intl.PluralRules`): en portugués `0` es singular.

**Qué NO copiamos:** dominio por país. Para un SaaS multi-tenant es inviable.

---

## 6. Google Search Central — las reglas del juego

No es una empresa referente: es el árbitro. Sus guías de sitios multirregionales
y multilingües definen lo que funciona:

- URL distinta por idioma (no cookies, no parámetros débiles).
- hreflang recíproco + `x-default` para la página que negocia/selecciona idioma.
- No redirigir automáticamente según el idioma o ubicación percibidos del visitante.
- Canonical dentro del mismo idioma, nunca cruzando idiomas.
- 5xx ante fallas transitorias (reintenta), 404 solo si el recurso no existe.
- Datos estructurados `Product`/`Offer` para rich results.

---

## Anti-patrones prohibidos (checklist de code review)

| Anti-patrón | Por qué | Severidad |
|-------------|---------|-----------|
| Redirigir una URL que ya tiene idioma | Impide indexar variantes (Googlebot = EE.UU.) | 🔴 Bloqueante |
| 301 en la negociación de idioma | El navegador lo cachea y congela el idioma | 🔴 Bloqueante |
| `catch {}` → `notFound()` en data fetching | Caída de backend = desindexación masiva | 🔴 Bloqueante |
| Canonical apuntando a otro idioma | Google descarta la variante | 🔴 Bloqueante |
| JSON-LD con `JSON.stringify` sin escapar | XSS almacenado desde input del tenant | 🔴 Bloqueante |
| URL noindex en el sitemap | Señales contradictorias | 🟠 Alta |
| Texto de UI hardcodeado en páginas del storefront | No se traduce; rompe D5 | 🟠 Alta |
| `new Intl.NumberFormat('es-AR', …)` fijo | Ignora idioma/región del visitante | 🟡 Media |
| País como señal que pisa a Accept-Language | Viajeros y expatriados ven otro idioma | 🟡 Media |
