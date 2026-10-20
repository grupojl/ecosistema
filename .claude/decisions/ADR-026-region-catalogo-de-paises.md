# ADR-026: Región — catálogo factual por región y país

**Fecha:** 2026-10-20
**Estado:** Aceptado

## Contexto

El producto ya sabe operar por país en tres capas separadas: **Market** (presencia operativa, ADR-014), **idioma** (URL por idioma y tabla factual de ~180 países, ADR-016/017) y **pagos/impuestos** (Stripe, fuera del modelo). Lo que no existía es un lugar único donde se pueda ver, para cualquier país, *qué soporta hoy y qué le falta*. Esa información estaba dispersa en ADR, en comentarios de `countries.ts` y en `phone-normalization.ts`, y la pregunta "¿estamos listos para vender en México?" no se podía responder sin leer código.

## Decisión

Crear `domain/region/` como **catálogo factual** con tres carpetas, `america`, `asia` y `europa`, y **un archivo por país** (`{iso}.md`) que recorre siempre las mismas capas (identidad, idioma, moneda y pagos, logística, teléfono y mensajería, legal, UI) y un **estado de soporte** (🟢 operativo · 🟡 candidato · ⚪ sin evaluar · 🔴 restringido).

- El país se identifica siempre por ISO 3166-1 alfa-2 en mayúscula, igual que `Organization.countryCode` y `Market.countryCode`.
- La carpeta **referencia** al código y a los ADR; no los copia ni los reemplaza. Si hay contradicción, gana el código y el ADR.
- Lo no verificado se marca **a validar**; no se inventan tasas, plazos ni requisitos legales.
- Ninguna ficha, ni su ausencia, puede bloquear una venta (ADR-014: `resolveMarket()` nunca devuelve null).

## Alternativas descartadas

- **Registro de países en código ahora (tabla tipada con moneda, prefijo y estado)** — sería una segunda fuente de verdad junto a `countries.ts` sin un consumidor que la pida. Queda como pendiente en el README de `region`; se decide cuando algo del producto la necesite.
- **Modelar precios, impuestos o idioma por país dentro del producto** — ya descartado en ADR-014/016: lo resuelven Stripe, Stripe Tax y la i18n de Next.js.
- **Cubrir los ~195 países desde el inicio** — documentación sin dueño que envejece. Se parte de los países con relevancia comercial en América, Asia y Europa (los de mayor mercado o cercanía); AR, BR, CO y MX tienen ficha completa y el resto sale de la plantilla marcado "a validar". África y Oceanía quedan fuera hasta que haya demanda.

## Consecuencias

**Se gana:** un país nuevo es una ficha y una fila; el estado de cada país es visible sin leer código; las capas de adaptación quedan comparables.

**Se sacrifica / deuda consciente:**
- Las regiones tienen los países más relevantes, no los 195; se completan por demanda.
- Las fichas generadas son esqueletos con idioma y moneda; todo lo demás dice "a validar" y hay que completarlo al evaluar cada país.
- Idioma y moneda de las tablas son informativos y pueden envejecer: hay que revisarlos al abrir un país.
- Los estados 🟡 de MX, CO y BR reflejan trabajo previo y ejemplos de los ADR, no operaciones reales.

## Referencias

- `domain/region/README.md` y subcarpetas
- `decisions/ADR-014-markets-global.md`, `ADR-016-seo-i18n-global.md`, `ADR-017-idioma-mundial-y-orden.md`
- `real-ecommerce-front/lib/i18n/countries.ts`, `config.ts`
- `chatia-backend/src/infrastructure/channels/whatsapp/phone-normalization.ts` (ecosistema-ms)
