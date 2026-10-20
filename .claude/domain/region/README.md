# Región — América, Asia y Europa

## Qué es esta carpeta

El **catálogo factual del mundo en el que opera el producto**: región → país, y para cada país qué hay que adaptar en el software
(idioma, moneda, pagos, logística, legal, teléfono y direcciones). Responde **"¿qué es distinto en este país?"** y **"¿en qué estado
está el soporte de este país?"**. No define reglas de negocio nuevas: las que ya existen viven en sus ADR.

```
.claude/domain/region/
  README.md                 ← este archivo: modelo, reglas, estados, cómo agregar un país
  _plantilla-pais.md        ← ficha en blanco: copiarla para sumar un país
  america/                  ← Sudamérica · Centroamérica · Caribe · Norteamérica
    README.md               ← índice de la región (tabla país → idioma, moneda, estado)
    ar.md  br.md  co.md  mx.md  …   ← UN archivo por país, nombrado con su ISO en minúscula
  europa/
    README.md
    es.md  fr.md  de.md  …
  asia/                     ← incluye Medio Oriente
    README.md
    jp.md  in.md  sa.md  …
```

Solo hay tres regiones por ahora. Para sumar otra (por ejemplo África u Oceanía) se crea su carpeta con su `README.md` de índice y una ficha por país.
AR, BR, CO y MX tienen la ficha **completa** (con datos del proyecto); el resto se generó desde la plantilla y está marcado **a validar**.
## El norte

*Un país nuevo es una ficha y una fila, no un proyecto.* La plataforma tiene que poder decir, para cualquier país del mundo, qué
soporta hoy y qué le falta — sin leer el código.

**Referentes:** **Shopify Markets** (el dueño declara dónde opera; el sistema resuelve) · **Stripe** (monedas, impuestos y medios de
pago por país como datos, no como `if`) · **IKEA** (idioma ≠ país) · **Mercado Libre** (LatAm primero).

## Reglas no negociables

```
Fuente        el código manda para lo que ya resuelve (countries.ts, Market, Stripe); esta carpeta lo REFERENCIA, no lo copia
Jerarquía     región (carpeta) → subregión (en el índice) → país (un .md); el país se identifica SIEMPRE por ISO 3166-1 alfa-2 en mayúscula ("AR")
Idioma ≠ país el idioma es una preferencia de la persona (ADR-016/017); acá solo se anota el idioma dominante como dato informativo
Sin inventar  lo que no se verificó se marca "a validar"; nunca una tasa, un plazo o un requisito legal inventado
Nunca bloquea ninguna ficha ni ausencia de ficha puede impedir una venta: resolveMarket() siempre cae al Market por defecto (ADR-014)
Estados       cada país declara su estado de soporte (ver abajo); un país sin ficha es "sin evaluar", no "no soportado"
```

## Qué NO modela (ya decidido, no se reabre acá)

| Tema | Dónde se resuelve | Decisión |
|---|---|---|
| Precios por país | Stripe (multi-moneda) | ADR-014: no se modelan por Market |
| Impuestos por país | Stripe Tax | ADR-014: complejidad legal fuera del producto |
| Idioma por Market | i18n de Next.js, `lib/i18n/` | ADR-014/016/017 |
| Restricciones de productos por país | — | ADR-014: over-engineering para la escala actual |

Las fichas pueden **mencionar** estos temas como información de contexto (p. ej. cómo se llama el impuesto), siempre marcado como
referencia a validar con un asesor local. No son contrato.

## Estados de soporte de un país

| Estado | Significa | Qué existe |
|---|---|---|
| 🟢 **Operativo** | Hay organizaciones operando o el país es el base | Market funcionando, pagos y logística probados |
| 🟡 **Candidato** | Hay interés concreto o trabajo previo | Ficha completa; faltan pruebas con una organización real |
| ⚪ **Sin evaluar** | Solo figura en la tabla del continente | Nada; el sistema igual lo atiende con el Market por defecto |
| 🔴 **Restringido** | Hay una razón para no operar (sanciones, regulación, riesgo) | Ficha con el motivo; requiere decisión explícita |

Hoy: **AR** es el país base (ADR-014: `Organization.countryCode` por defecto `AR`). **MX**, **CO** y **BR** tienen ficha como
candidatos; el resto está sin evaluar.

## Capas de adaptación (el checklist de cada ficha)

Cada ficha responde por las mismas capas, para que dos países se puedan comparar de un vistazo:

| Capa | Pregunta | Dónde vive en el software |
|---|---|---|
| Identidad | ¿Código ISO, nombre, continente, prefijo telefónico? | `Organization.countryCode`, `Market.countryCode` |
| Idioma | ¿Qué idioma(s) hablan y cuál tenemos activo? | `real-ecommerce-front/lib/i18n/` (`countries.ts`, `config.ts`) |
| Moneda | ¿En qué se cobra? | Stripe / proveedor de pagos |
| Pagos | ¿Qué medios locales existen y cuáles integramos? | `pasarelapagos-backend` (ecosistema-ms) |
| Logística | ¿Con quién se despacha? | `Market.fulfillmentConfig` (ADR-014) |
| Teléfono y mensajería | ¿Cómo se normalizan los números? ¿WhatsApp es el canal dominante? | `chatia-backend` (`phone-normalization.ts`) |
| Direcciones | ¿Qué campos tiene una dirección? | Checkout del storefront |
| Legal e impuestos | ¿Qué hay que cumplir? | Fuera del producto (asesor); solo se anota |
| UI | ¿RTL? ¿formatos de fecha y número? | `@real/ui`, `RTL_LOCALES` (ADR-017) |

## Cómo agregar un país

1. Copiar `_plantilla-pais.md` a `{region}/{iso-en-minuscula}.md` y completarla. Lo desconocido va como **a validar**.
2. Agregar su fila en el `README.md` de la región (estado, idioma, moneda), con enlace a la ficha.
3. Si el idioma dominante no está en `lib/i18n/countries.ts`, es deuda de código (ADR-017 D1): abrir una entrada en `roadmap/deuda-tecnica.md`.
4. Si el país requiere un proveedor de pagos o logística nuevo, seguir `checklists/nuevo-provider-pago.md` en ecosistema-ms.
5. Pasarlo a 🟡 solo con trabajo real previo, y a 🟢 solo cuando una organización lo opere de punta a punta.

## Relación con otros documentos

| Documento | Qué aporta |
|---|---|
| `decisions/ADR-014-markets-global.md` | Market: la presencia operativa de una organización en un país; `resolveMarket()` |
| `decisions/ADR-016-seo-i18n-global.md` · `ADR-017-idioma-mundial-y-orden.md` | Idioma en la URL; tabla factual de 180 países |
| `decisions/ADR-024-ui-ux-adaptable.md` | Estados de vista y formatos dentro de la UI |
| `decisions/ADR-026-region-catalogo-de-paises.md` | La decisión de crear esta carpeta |
| `contracts/markets-api.md` · `contracts/seo-i18n.md` | Contratos de código que esta carpeta referencia |
| `domain/flows/storefront-buy.md` | Dónde el país del visitante entra al flujo de compra |

## Pendiente

- Fuente única en código: hoy la lista de países vive en `lib/i18n/countries.ts` (solo idioma). Si más adelante se necesita moneda, prefijo o
  estado por país **en código**, conviene un único registro tipado (`packages/`), con estas fichas como su documentación. Aún no se decidió.
- Completar las fichas generadas (prefijo, logística, pagos, legal) país por país: hoy todo eso dice **a validar**.
- Los países de África y Oceanía que figuraban en una primera versión se quitaron al dejar solo tres regiones; se recuperan creando sus carpetas.
