# realsass-docs-front

**Estado:** F1 — lee de superadmin (ADR-021) · **Puerto:** 3024 · **Norte:** `architecture/12-docs-norte.md`

Front público de documentación. Solo renderiza: el contenido lo edita superadmin
(`grupojl-control`) y se lee de `GET /internal/docs/:eco/:locale/{navigation|page}`.
Contrato: `superadmin/.claude/contracts/docs-internal.md`.

## Estructura

```
app/[locale]/layout.tsx            html + tema + header (valida locale)
app/[locale]/docs/page.tsx         home de las docs
app/[locale]/docs/[...slug]/       página de contenido (404 si no existe)
app/api/revalidate/route.ts        webhook de superadmin: expira el tag docs:<eco>
lib/docs/types.ts                  DocPage, DocKind, DocSection (contrato de superadmin)
lib/docs/repository.ts             interfaz DocsRepository
lib/docs/internal-repository.ts    implementación sobre /internal/docs/* (fetch + tags)
lib/docs/env.ts                    DOCS_BACKEND_URL, INTERNAL_API_KEY, DOCS_ECOSYSTEM_ID
lib/docs/index.ts                  punto único de resolución del repositorio
lib/markdoc/config.ts              whitelist de nodos y tags
lib/markdoc/render.tsx             Markdoc → React
components/markdoc/                componentes de la whitelist
components/docs/                   shell: header, sidebar, TOC, pager
```

## Variables de entorno (todas de servidor salvo la URL pública)

| Variable | Requerida | Uso |
|---|---|---|
| `DOCS_BACKEND_URL` | sí | base de grupojl-control-backend |
| `INTERNAL_API_KEY` | sí | mismo valor que superadmin; se envía y se exige en `/api/revalidate` |
| `DOCS_ECOSYSTEM_ID` | no (default `welver`) | ecosistema que sirve este deploy |
| `NEXT_PUBLIC_DOCS_URL` | no | canonical / metadataBase |

## Whitelist de Markdoc

Idéntica a `DOC_MARKDOC_TAGS` de superadmin: `callout`, `steps`, `step`, `tabs`, `tab`, `badge`.
Si se agrega un tag allá, hay que agregarlo en `lib/markdoc/config.ts` y `render.tsx`.
Un tag fuera de la lista se descarta y el HTML crudo se escapa.

## Comportamiento de errores (ADR-016)

404 del backend → `null` → 404 público. Cualquier otra falla → 5xx.
Las rutas son dinámicas: `next build` no necesita el backend.

## Pendiente

- Dockerfile (con stage `contracts`, ADR-019), workflow de CI y servicio en Railway.
- Vista previa de borradores (DOC-09 en superadmin).
- Búsqueda, resaltado de sintaxis, sitemap y hreflang (F3).
- Probar contra superadmin real (hoy solo contra un backend simulado).
