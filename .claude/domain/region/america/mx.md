# México — `MX`

> Ficha completa. Lo marcado **a validar** no se verificó con un asesor local. Estados: ver `../README.md`.

| | |
|---|---|
| **Estado** | 🟡 Candidato (usado como ejemplo de segundo Market en ADR-014; ya contemplado en la normalización de teléfonos) |
| **Región / subregión** | América · Norteamérica |
| **Código ISO 3166-1 alfa-2** | `MX` |
| **Última revisión** | 2026-10-20 · creación de la estructura |

## Identidad
- Nombre local: México · prefijo: +52 · zonas horarias: varias (a validar)

## Idioma
- Dominante: `es` · diccionario activo: **es** ✓ · no RTL

## Moneda y pagos
- Moneda: MXN
- Medios locales relevantes: tarjetas, transferencia SPEI, pago en efectivo en tiendas (a validar cuáles cubre el proveedor)
- Proveedor por defecto en LatAm: MercadoPago
- Proveedores a integrar: a validar según el volumen

## Logística
- Operadores habituales: a validar
- Dirección: estado, municipio/alcaldía, colonia, calle y número, código postal (5 dígitos, a validar)
- Configuración: `Market{ countryCode: 'MX' }` con `fulfillmentConfig` propio (ADR-014)

## Teléfono y mensajería
- WhatsApp entrega móviles como `521…` y la API de envío espera `52…`: **ya cubierto** en `phone-normalization.ts`
- WhatsApp es canal dominante (a validar para el rubro)

## Legal e impuestos *(referencia a validar con un asesor; NO es contrato)*
- Impuesto al consumo: IVA · privacidad: ley federal de protección de datos de particulares · facturación electrónica (CFDI) obligatoria para contribuyentes — a validar alcance

## UI y formatos
- Fecha `dd/mm/aaaa` · decimal punto, miles coma (a validar)

## Qué falta para subir de estado
- [ ] Una organización real operando con Market `MX`
- [ ] Logística y medios de pago locales verificados
- [ ] Revisión legal local
