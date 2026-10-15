# ADR-020: Front de documentación (`realsass-docs-front`) con contenido gestionado desde superadmin

**Fecha:** 2026-10-13
**Estado:** Propuesto
**Guía operativa:** `architecture/12-docs-norte.md`

## Contexto

El ecosistema tiene 2 backends, 3 fronts, packages compartidos y una integración con
ecosistema-ms. Toda esa documentación vive hoy en `.claude/`, pensada para el equipo y
para el agente, no para quien integra o usa el producto. Se necesita una guía y un
tutorial públicos cuyo contenido pueda editar el superadmin sin pasar por un deploy.

## Decisión

1. Se crea un cuarto front, `realsass-docs-front` (Next.js App Router, puerto 3024),
   que **solo renderiza** contenido.
2. El contenido es **dato**: páginas en Markdoc, con `kind` Diátaxis obligatorio,
   estado `draft | published` y versiones. Se edita desde superadmin.
3. El front lee por tRPC server caller, como el resto. Mientras no exista el router
   `docs`, lo hace a través de la interfaz `DocsRepository` con una implementación
   mock temporal.
4. Formato **Markdoc** con whitelist de tags. Se descarta MDX.
5. Cache por ISR con `revalidateTag` al publicar.

## Alternativas descartadas

- **MDX en el repo (docs-as-code)** — excelente para docs técnicas, pero el requisito es
  que lo gestione el superadmin sin deploy. Se podría complementar más adelante.
- **MDX en la base de datos** — ejecuta código del autor en el servidor.
- **Mintlify / GitBook / Docusaurus como servicio** — otro login y otro lugar de
  contenido, fuera del RBAC del superadmin y del contrato tipado.
- **Meter las docs dentro de `realsass-sass-front`** — mezcla una superficie pública y
  cacheable con el panel del dueño, y acopla sus deploys.
- **Editor WYSIWYG con HTML guardado** — obliga a sanitizar HTML; Markdoc evita el problema.

## Consecuencias

**Se gana:** contenido editable sin deploy; superficie de ejecución cerrada; estructura
de docs consistente por `kind`; el front es intercambiable porque solo conoce `DocPage`.

**Se sacrifica:** un front más que mantener y desplegar (Dockerfile, Railway, CI); una
dependencia nueva (`@markdoc/markdoc`, dueño: docs-front).

**Deuda consciente:**
- `lib/docs/mock-repository.ts` contiene contenido de ejemplo. Se elimina en F1.
- Falta definir el backend dueño del contenido (pregunta abierta en el norte).
- El editor de superadmin vive en otro repo y queda fuera de F0.
- Dockerfile, workflow de CI y servicio de Railway: pendientes hasta aprobar la maqueta.

## Referencias

- `architecture/12-docs-norte.md`
- ADR-016 (URL e idioma) · ADR-018 (dependencias) · ADR-019 (contratos tRPC)
- `realsass-docs-front/`
