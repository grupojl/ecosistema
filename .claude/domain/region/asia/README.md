# Asia (incluye Medio Oriente)

> Un archivo por país (`{iso}.md`), todos con las mismas capas. **Idioma** = dominante según `real-ecommerce-front/lib/i18n/countries.ts` (✓ = diccionario activo hoy: es, pt, en, fr, de; "multilingüe" = fuera de la tabla a propósito, decide `Accept-Language`, ADR-017 D1). **Moneda** = ISO 4217, dato informativo (los cobros los resuelve el proveedor, ADR-014). **Estado** según `../README.md`.

Los países de idioma árabe, hebreo, persa y urdu son **RTL**: la arquitectura está lista pero ningún diccionario RTL está activo (ADR-017 D3). Antes de operar en ellos hay que activar el idioma con revisión nativa.

## Asia Oriental y Sudeste Asiático

| ISO | País | Idioma | Moneda | Estado |
|---|---|---|---|---|
| [JP](jp.md) | Japón | ja | JPY | ⚪ |
| [CN](cn.md) | China | zh | CNY | ⚪ |
| [TW](tw.md) | Taiwán | zh | TWD | ⚪ |
| [KR](kr.md) | Corea del Sur | ko | KRW | ⚪ |
| [ID](id.md) | Indonesia | id | IDR | ⚪ |
| [TH](th.md) | Tailandia | th | THB | ⚪ |
| [VN](vn.md) | Vietnam | vi | VND | ⚪ |
| [PH](ph.md) | Filipinas | multilingüe | PHP | ⚪ |
| [MY](my.md) | Malasia | ms | MYR | ⚪ |
| [SG](sg.md) | Singapur | multilingüe | SGD | ⚪ |

## Asia Meridional

| ISO | País | Idioma | Moneda | Estado |
|---|---|---|---|---|
| [IN](in.md) | India | multilingüe | INR | ⚪ |
| [PK](pk.md) | Pakistán | multilingüe | PKR | ⚪ |
| [BD](bd.md) | Bangladés | bn | BDT | ⚪ |

## Medio Oriente

| ISO | País | Idioma | Moneda | Estado |
|---|---|---|---|---|
| [TR](tr.md) | Turquía | tr | TRY | ⚪ |
| [IL](il.md) | Israel | he *(RTL)* | ILS | ⚪ |
| [SA](sa.md) | Arabia Saudita | ar *(RTL)* | SAR | ⚪ |
| [AE](ae.md) | Emiratos Árabes Unidos | ar *(RTL)* | AED | ⚪ |
| [QA](qa.md) | Catar | ar *(RTL)* | QAR | ⚪ |
