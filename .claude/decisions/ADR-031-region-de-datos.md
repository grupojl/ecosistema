# ADR-031: Región de datos de la organización

**Fecha:** 2026-11-05
**Estado:** Aceptado (la validación legal por un abogado local está pendiente; ver Consecuencias)

## Contexto

El producto arranca en Argentina y Estados Unidos con **una sola región física** (propuesta de hosting: un VPS en Ashburn con Cloudflare delante; esa elección de infraestructura **no** se decide acá). Hoy existen dos conceptos de país:

- `Organization.countryCode`: de qué país es la organización (default `AR`).
- `Market` (ADR-014): a qué países vende o entrega y cómo (`fulfillmentConfig`). Modela logística, no leyes de datos.

Falta un tercero: **dónde viven los datos de una organización**. Sin ese dato no se puede decir a un cliente (por ejemplo un municipio argentino de Welver) dónde están sus datos, ni se puede enrutar o mover una organización el día que haya una segunda región. Una organización argentina con datos en EE.UU. no se puede expresar con `countryCode` solo.

## Decisión

Agregar `Organization.dataRegion` (texto, default `us`) con dos regiones lógicas por ahora, **`ar` (Argentina) y `us` (Estados Unidos)**, y separar tres conceptos que no se mezclan:

| Concepto | Pregunta que responde | Dónde |
|---|---|---|
| `countryCode` | ¿De qué país es? Define **qué ley aplica**. | `Organization` |
| `Market` | ¿A qué países vende y cómo se cumple? | tabla `markets` (ADR-014) |
| `dataRegion` | ¿Dónde viven físicamente sus datos? | `Organization` |

Reglas:

1. **Derivada del país.** `regionDe(countryCode)` (`realsass-sass-back/src/regions/data-region.ts`) es el único lugar que decide la región. Nadie más lee el país para decidirlo. Nunca falla: país inválido → región por defecto (mismo criterio que `resolveMarket`, ADR-014).
2. **Se asigna al crear la organización y no cambia** sin un proceso de migración de datos. Por eso no tiene mutación en tRPC.
3. **Dos regiones lógicas: `ar` y `us`.** Argentina → `ar`, Estados Unidos → `us`, y cualquier otro país → `us` (región por defecto). El id nombra una región, no un país.
   **Aviso de honestidad:** hoy no hay infraestructura en Argentina. Las dos regiones se sirven desde la misma infraestructura (EE.UU.), así que `ar` es una **etiqueta lógica** y **no promete residencia física en el país**. Ningún contrato ni material comercial puede decir "datos alojados en Argentina" mientras no exista un despliegue real allí. El campo no cambia comportamiento todavía; guarda el dato para no migrar a ciegas el día que `ar` tenga infraestructura propia.
4. **No es público.** El storefront y los endpoints públicos no exponen `dataRegion` (igual que `plan` y `enabledProducts`).
5. **La ley se aplica por reglas en el código, no por el campo.** La etiqueta no restringe nada por sí sola. Las reglas por país (retención, consentimiento, borrado, exportación, contrato de transferencia internacional) viven en una tabla de políticas **clave `countryCode`**, que se construye cuando haya el primer consumidor real (retención de Welver). Los valores legales los valida un abogado local; no se inventan.
6. **Dar infraestructura propia a `ar` (o sumar otra región) es un cambio de mapa más un ADR.** Se agrega a `DATA_REGIONS` y a `REGION_BY_COUNTRY`; el router por región y la base propia de `ar` se deciden en un ADR aparte cuando exista el primer cliente que lo exija. Las organizaciones ya etiquetadas `ar` solo necesitan migrar sus datos, no reclasificarse.

## Alternativas descartadas

- **Solo `countryCode`** — no distingue "operación argentina, datos en EE.UU.", que es justo lo que hay que decirle a un municipio.
- **Reutilizar `Market`** — Market es logística por país de destino (ADR-014); una tienda argentina que vende a Colombia sigue regida por su ley de origen.
- **Región física por organización desde ya** (varios servidores y bases) — duplica infraestructura y operación sin cliente que lo exija. Se hace cuando un contrato o la latencia medida lo pidan.
- **Bases de datos compartidas entre regiones** — los datos igual cruzan países (no cumple residencia) y agrega latencia a cada consulta.
- **Campo editable por el owner** — la residencia es una promesa contractual; cambiarla es migrar datos, no editar un formulario.

## Consecuencias

**Se gana:** un dato para responder dónde viven los datos de cada organización; un solo punto (`regionDe`) para cambiar cuando haya otra región; ninguna decisión de infraestructura queda cerrada.

**Se sacrifica / deuda consciente:**
- **Migración sin aplicar:** `20261105120000_organization_data_region` agrega la columna (default `us`) y marca `ar` a las organizaciones existentes de Argentina; hay que correr `prisma migrate deploy` en cada entorno.
- **`ar` sin infraestructura propia:** la etiqueta existe, el despliegue en Argentina no. Ver punto 3 de la Decisión.
- **Tabla de políticas por país:** pendiente hasta el primer consumidor (retención de Welver). Mientras tanto, la etiqueta sola **no** da cumplimiento.
- **Validación legal pendiente:** que un abogado local confirme que contrato de tratamiento de datos más políticas alcanzan para la Ley 25.326 con datos en EE.UU.
- **Contrato de acceso entre backs:** `ecommerce-back` y futuros backs no reciben `dataRegion` en `OrganizationAccess` todavía; se agrega (aditivo) cuando un back lo necesite.
- **Nombre:** "región de datos" no es la "región" geográfica del catálogo `domain/region/` (ADR-026), que describe países por continente. No se reemplazan.

## Referencias

- `realsass-sass-back/prisma/schema.prisma` (`Organization.dataRegion`)
- `realsass-sass-back/prisma/migrations/20261105120000_organization_data_region/`
- `realsass-sass-back/src/regions/data-region.ts` y `data-region.spec.ts`
- `realsass-sass-back/src/organizations/repository/prisma-organizations.repository.ts` (`create`)
- ADR-014 (Markets), ADR-016 (SEO e idioma), ADR-026 (catálogo de países)
- `domain/welver-domain.md` (sección 13.1 y 15), `domain/manzana-domain.md` y `domain/mexus-domain.md` (sección Plataforma)
