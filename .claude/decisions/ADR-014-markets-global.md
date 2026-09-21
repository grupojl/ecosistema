# ADR-014 — Markets: expansión global de organizaciones

**Fecha:** 2026-09-19
**Estado:** Aceptado
**Autores:** Equipo GrupoJL

---

## Contexto

Las organizaciones del ecosistema welver operan en un país base (AR por defecto).
El crecimiento natural lleva a que una organización quiera operar en múltiples países:
vender en Colombia con un proveedor logístico colombiano, en México con uno mexicano,
sin mezclar stock ni envíos desde Argentina.

El problema tiene tres capas distintas que NO deben confundirse:

1. **Geolocalización del visitante** — ¿de dónde viene el comprador?
2. **Resolución de fulfillment** — ¿desde qué proveedor despacho en ese país?
3. **Segmentación de mercado** — ¿qué reglas operativas aplican en ese país?

---

## Referente: Shopify Markets (2021–presente)

Shopify es el referente porque modeló esto como **entidad de dominio de primer nivel**,
no como configuración de envío. Sus principios que adoptamos:

- Un `Market` es una presencia operativa declarada por el dueño, no detectada por el sistema
- El sistema resuelve dentro de los Markets declarados; si no hay match → fallback al default
- El catálogo es global; el fulfillment es local al Market
- Nunca se bloquea una venta por falta de Market — siempre hay fallback graceful

**Lo que NO copiamos de Shopify:**
- Precios por Market (Stripe maneja multi-moneda — duplicar sería deuda técnica)
- Idioma por Market (Next.js i18n lo resuelve independientemente)
- Impuestos por Market (Stripe Tax existe para eso, complejidad legal enorme)

---

## Decisión

### Bounded context: Market vive en `realsass-sass-back`

`Market` es una decisión del dueño del negocio (quiero operar en CO), no del catálogo.
`Organization` vive en `sass-back` → `Market` vive en `sass-back`.
`ecommerce-back` consume Markets vía tRPC para resolver fulfillment en órdenes.

**Alternativa descartada:** Market en ecommerce-back.
Razón: crearía acoplamiento inverso — el catálogo definiría contexto de negocio.
Viola el bounded context de domain/application.

### Modelo canónico

```
Organization
  ├── countryCode: "AR"           ← país base del dueño (nuevo campo)
  └── markets: Market[]
        ├── { countryCode: "AR", isDefault: true,  isActive: true }
        └── { countryCode: "CO", isDefault: false, isActive: true }
              └── fulfillmentConfig: JSONB
                    └── { provider: "Proveedor CO", contactEmail: "...", notes: "..." }
```

### Regla de resolución universal

```typescript
// Aplica a fulfillment, puntos de venta, config local — cualquier feature futuro
resolveMarket(organizationId, visitorCountryCode):
  1. Buscar Market{ organizationId, countryCode: visitorCountryCode, isActive: true }
  2. Si no existe → Market{ organizationId, isDefault: true }
  3. Nunca null — siempre resuelve
```

Una función. Resuelve todo. Escalable a 5 años sin cambiar el modelo.

---

## Consecuencias

### Positivas
- El dueño declara en qué países opera (control explícito, no magia de detección)
- Agregar un nuevo país = crear un Market, sin tocar código
- Futuras entidades (SalesPoint, Warehouse, PriceOverride) cuelgan de Market, no de Organization
- Superadmin ve Markets por organización sin lógica adicional

### Negativas / Riesgos
- `Organization` necesita migración para agregar `countryCode`
- La detección de IP del visitante requiere servicio externo (MaxMind GeoIP o similar)
- `fulfillmentConfig` como JSONB es flexible pero no tipado en DB — usar Zod en application layer

### Pendiente (fuera de este ADR)
- SalesPoint como entidad hija de Market
- Warehouse con stock por Market
- PriceOverride por Market (cuando se necesite)

---

## Implementación

Ver `.claude/modules/sass-back/markets.md` para el checklist de implementación.
Ver `.claude/contracts/markets-api.md` para los contratos HTTP y tRPC.
