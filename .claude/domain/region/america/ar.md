# Argentina — `AR`

> Ficha completa. Lo marcado **a validar** no se verificó con un asesor local. Estados: ver `../README.md`.

| | |
|---|---|
| **Estado** | 🟢 Operativo (país base: `Organization.countryCode` por defecto `AR`, ADR-014) |
| **Región / subregión** | América · Sudamérica |
| **Código ISO 3166-1 alfa-2** | `AR` |
| **Última revisión** | 2026-10-20 · creación de la estructura |

## Identidad
- Nombre local: Argentina · prefijo telefónico: +54 · zona horaria: UTC−3 (una sola, sin horario de verano — a validar)

## Idioma
- Dominante: `es` (en `countries.ts`) · diccionario activo: **es** ✓ · no es multilingüe de peso comparable · no RTL

## Moneda y pagos
- Moneda: ARS
- Medios locales relevantes: tarjetas, transferencia, billeteras (a validar el detalle)
- Proveedor por defecto en LatAm: MercadoPago (ecosistema-ms)
- Proveedores a integrar: ninguno identificado

## Logística
- Operadores de envío habituales: a validar
- Dirección: provincia, localidad, calle y número, código postal (a validar formato exacto CPA / 4 dígitos)
- Configuración: `Market{ countryCode: 'AR', isDefault: true }` → `fulfillmentConfig`

## Teléfono y mensajería
- WhatsApp entrega los móviles como `549…` y la API de envío exige `54…`: **ya cubierto** en `phone-normalization.ts` (con test)
- Canales dominantes en la práctica: WhatsApp e Instagram (según `domain` de welver en ecosistema-ms)

## Legal e impuestos *(referencia a validar con un asesor; NO es contrato)*
- Impuesto al consumo: IVA · privacidad: Ley 25.326 de protección de datos personales · facturación electrónica obligatoria vía el organismo fiscal (ARCA, ex AFIP) — a validar alcance
- Restricciones de venta conocidas: a validar

## UI y formatos
- Fecha `dd/mm/aaaa` · separador decimal coma y de miles punto (a validar contra la configuración regional del storefront)

## Qué falta para subir de estado
- Ya es el país base; pendiente documentar logística real y medios de pago verificados.
