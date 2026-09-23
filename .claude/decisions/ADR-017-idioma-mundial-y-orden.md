# ADR-017: Idioma mundial (180 países) + RTL listo + Order.locale

**Fecha:** 2026-09-22
**Estado:** Aceptado
**Relacionado:** ADR-016 (SEO + idioma), ADR-014 (Markets)

---

## Contexto

Dos preguntas de negocio abrieron esta extensión de ADR-016:

1. *"¿Alcanza el código para adaptarse a cada país al escalar mundialmente?"*
   Respuesta encontrada: no del todo. `lib/i18n/config.ts` tenía una tabla
   país→idioma de ~35 entradas hardcodeada junto con la lógica de idiomas
   **activos**. Un país fuera de esa lista (ej. Alemania, Japón) caía en
   silencio a `es` como idioma "primario" — indexando esa tienda en el
   idioma equivocado sin que nadie se enterara hasta ver Search Console.

2. *"¿Cómo generamos el invoice en el idioma del comprador?"*
   Respuesta encontrada: no había forma. `Order` no guardaba el idioma de
   la sesión de compra, solo `visitorCountryCode` (ADR-014) — y país ≠
   idioma es precisamente la regla que ADR-016 estableció para el storefront.
   Un visitante francés comprando en una tienda con sede en Argentina
   navega en `/fr/`, pero su pedido no tenía forma de registrar eso.

---

## Decisión

### D1 — Separar "idioma del mundo" de "idioma activo" en dos archivos

`lib/i18n/countries.ts` (nuevo): mapa **factual** de 180 países → su idioma
ISO 639-1 dominante/oficial. No cambia cuando se activa un idioma nuevo.

`lib/i18n/config.ts`: `LOCALES` es la lista de idiomas con diccionario
**activo** (`es`, `pt`, `en`, `fr`, `de` desde este ADR). Activar un idioma
nuevo es agregar su diccionario + sumarlo a `LOCALES` — nunca se vuelve a
tocar `countries.ts`.

Países con más de un idioma dominante de peso comparable (Canadá, Suiza,
Bélgica, India, Pakistán, Nigeria, Sudáfrica, Singapur) quedan **excluidos
a propósito** de la tabla — ahí decide `Accept-Language`, nunca un mapeo
fijo que le asignaría el idioma equivocado a una parte de la población
(norte IKEA, ya establecido en ADR-016).

### D2 — El fallback deja de mentir en silencio

`primaryLocaleForCountry()` distingue dos casos, antes indistinguibles:

- País multilingüe → cae a `DEFAULT_LOCALE` **sin log**. Es ambigüedad
  esperada, no un bug.
- País con idioma real y conocido pero **sin diccionario activo** (ej.
  Japón → `ja`) → cae a `DEFAULT_LOCALE` **con `console.warn`**, nombrando
  el país y el idioma faltante. Es deuda de producto accionable: la señal
  que dice "activá este idioma ya", en vez de enterarse por un reclamo.

### D3 — RTL: arquitectura lista, sin contenido fabricado

`RTL_LOCALES` existe, vacío a propósito. `<html dir>` en
`app/[locale]/layout.tsx` ya lee de ahí. Se decidió explícitamente **no**
fabricar diccionarios de árabe/hebreo/persa sin poder garantizar su calidad
sin revisión nativa — la arquitectura queda lista (activar es: diccionario +
`LOCALES` + `RTL_LOCALES`, cero cambios de layout), el contenido no.

### D4 — Order.locale, alcance acotado a propósito

Se agregó **solo** el campo `locale` a `Order` (nulo es válido) y el
cableado end-to-end para completarlo automáticamente:

```
lib/checkout/resolve-checkout-locale.ts   función pura: explícito > recordado > undefined
stores/use-locale-store.ts                recuerda el último /[locale]/ navegado (sessionStorage)
<LocaleMemo>                              alimenta ese store desde el layout de tienda
useCheckout()                             lo completa solo, sin que el caller tenga que acordarse
```

**Por qué un store aparte de la URL:** el checkout vive en
`app/(site)/checkout`, fuera de las rutas `/[locale]/` (nunca tuvo contexto
de tienda para ser indexable — ver ADR-016 D1). Sin este store, no hay forma
de saber en qué idioma navegaba el comprador al llegar al pago.

**Por qué se cortó ahí:** al tocar `checkout()` para agregar el campo se
encontraron tres bugs preexistentes en la misma función (`market` sin
resolver, arity de la llamada, `sessionId` fantasma — ver §Hardening). Se
decidió explícitamente no mezclarlos con este cambio. Consecuencia honesta:
`checkout()` sigue sin poder ejecutarse hasta que hardening los resuelva —
este ADR deja el campo listo para ese momento, no lo hace funcional hoy.

---

## Alternativas descartadas

- **Convertir moneda en el storefront al navegar:** se investigó
  `pasarelapagos-backend` antes de decidir. `RoutingService.selectProvider`
  exige un match exacto `(country, currency)` contra rutas de provider
  configuradas — no hay conversión en ningún punto del flujo de pago real.
  Agregar conversión cosmética en el front sin que el pago real la
  reflejara habría sido mostrar un precio que no es el que se cobra.
  Descartado hasta que exista una decisión de producto sobre precios por
  Market o conversión real vía Stripe.
- **Cookie única para "idioma explícito" y "último navegado":** se
  descartó mezclar ambos conceptos en `NEXT_LOCALE` — esa cookie es la
  elección explícita del usuario (gana sobre todo en la negociación, ver
  ADR-016 D2). Un store aparte (`use-locale-store.ts`, sessionStorage)
  evita que "recordar para el invoice" cambie accidentalmente la prioridad
  de negociación de idioma.
- **Adivinar el idioma del pedido por `visitorCountryCode`:** exactamente
  el error que ADR-016 corrigió en el storefront — país ≠ idioma.

---

## Consecuencias

### Positivas
- Cobertura de país→idioma pasó de ~35 a 180, con la exclusión de países
  multilingües documentada explícitamente en vez de ser un olvido.
- Agregar un idioma nuevo es un cambio de una capa (`config.ts` +
  diccionario), nunca del mapa mundial.
- El fallback de idioma da una señal accionable en vez de fallar en
  silencio.
- `Order.locale` queda listo — cuando hardening resuelva `checkout()`, el
  invoice puede generarse en el idioma correcto sin trabajo adicional.

### Negativas / riesgos
- `checkout()` sigue sin ejecutar (bug preexistente, no de este ADR).
- Conversión real de moneda sigue sin resolver — decisión de producto
  pendiente, no de arquitectura.
- Solo 5 idiomas activos; el resto del mundo (mandarín, ruso, árabe,
  hindi, etc.) queda "reconocido" en `countries.ts` pero indexado en el
  idioma default hasta que se activen.

### Pendiente consciente (fuera de este ADR)
- `ProductTranslation` (Fase 2, ya documentado en ADR-016).
- Precios por Market o conversión real de moneda (decisión de producto).
- Los 7 items de hardening descubiertos — ver
  `roadmap/deuda-tecnica.md`, ninguno causado por este trabajo.

---

## Referencias

- `.claude/decisions/ADR-016-seo-i18n-global.md` — el ADR que este extiende.
- `.claude/contracts/seo-i18n.md` §7 — contrato de `Order.locale`.
- `.claude/decisions/ADR-016-seo-i18n-status.md` — estado final verificado.
- `real-ecommerce-front/lib/i18n/countries.ts` — el mapa de 180 países.
- 99/99 tests, ~99% cobertura en `lib/i18n` + `lib/seo` + `lib/catalog` +
  `lib/checkout`, verificados contra el código real antes de cada entrega.
