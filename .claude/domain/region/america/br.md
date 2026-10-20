# Brasil — `BR`

> Ficha completa. Lo marcado **a validar** no se verificó con un asesor local. Estados: ver `../README.md`.

| | |
|---|---|
| **Estado** | 🟡 Candidato (el idioma `pt` ya tiene diccionario activo en el storefront) |
| **Región / subregión** | América · Sudamérica |
| **Código ISO 3166-1 alfa-2** | `BR` |
| **Última revisión** | 2026-10-20 · creación de la estructura |

## Identidad
- Nombre local: Brasil (en portugués: Brasil) · prefijo: +55 · zonas horarias: varias

## Idioma
- Dominante: `pt` · diccionario activo: **pt** ✓ · no RTL

## Moneda y pagos
- Moneda: BRL
- Medios locales relevantes: Pix, boleto bancario y tarjetas con cuotas (a validar cobertura del proveedor)
- Proveedor por defecto en LatAm: MercadoPago · alternativa fuera del LatAm core: dLocal (flag `dlocalEnabled`)

## Logística
- Operadores habituales: a validar
- Dirección: estado, ciudad, calle y número, CEP de 8 dígitos
- Configuración: `Market{ countryCode: 'BR' }`

## Teléfono y mensajería
- Móviles con el noveno dígito: a validar si WhatsApp exige una normalización como la de AR/MX (hoy no está en `phone-normalization.ts`)

## Legal e impuestos *(referencia a validar con un asesor; NO es contrato)*
- Régimen tributario complejo (varios impuestos según estado y tipo de venta) · privacidad: LGPD · nota fiscal electrónica (NF-e) — a validar alcance. **Es el país con mayor carga legal de la lista**: revisar antes de prometer fechas.

## UI y formatos
- Fecha `dd/mm/aaaa` · decimal coma, miles punto (a validar)

## Qué falta para subir de estado
- [ ] Una organización real operando con Market `BR`
- [ ] Definir cómo se resuelve la facturación fiscal (fuera del producto o integrada)
- [ ] Normalización de teléfonos verificada
