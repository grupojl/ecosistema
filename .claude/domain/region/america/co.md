# Colombia — `CO`

> Ficha completa. Lo marcado **a validar** no se verificó con un asesor local. Estados: ver `../README.md`.

| | |
|---|---|
| **Estado** | 🟡 Candidato (es el ejemplo de proveedor logístico local de ADR-014) |
| **Región / subregión** | América · Sudamérica |
| **Código ISO 3166-1 alfa-2** | `CO` |
| **Última revisión** | 2026-10-20 · creación de la estructura |

## Identidad
- Nombre local: Colombia · prefijo: +57 · zona horaria: UTC−5

## Idioma
- Dominante: `es` · diccionario activo: **es** ✓ · no RTL

## Moneda y pagos
- Moneda: COP
- Medios locales relevantes: PSE (débito bancario), billeteras como Nequi, tarjetas (a validar cobertura del proveedor)
- Proveedor por defecto en LatAm: MercadoPago
- Proveedores a integrar: a validar

## Logística
- Operadores habituales: a validar (ADR-014 ya prevé un "proveedor CO" en `fulfillmentConfig`)
- Dirección: departamento, municipio, dirección con nomenclatura propia, código postal (a validar)
- Configuración: `Market{ countryCode: 'CO' }` con `fulfillmentConfig` propio

## Teléfono y mensajería
- Móviles: a validar si requiere reglas en `phone-normalization.ts` (hoy solo AR y MX)
- WhatsApp: a validar como canal dominante

## Legal e impuestos *(referencia a validar con un asesor; NO es contrato)*
- Impuesto al consumo: IVA · privacidad: régimen de habeas data (Ley 1581 de 2012) · facturación electrónica obligatoria ante el organismo fiscal (DIAN) — a validar alcance

## UI y formatos
- Fecha `dd/mm/aaaa` · decimal coma, miles punto (a validar)

## Qué falta para subir de estado
- [ ] Una organización real operando con Market `CO`
- [ ] Proveedor logístico local y medios de pago verificados
- [ ] Revisión legal local
