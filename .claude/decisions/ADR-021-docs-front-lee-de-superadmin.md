# ADR-021: docs-front lee de superadmin — un ecosistema por deploy

**Fecha:** 2026-10-13
**Estado:** Aceptado
**Cierra:** las preguntas abiertas de ADR-020 / norte 12 (backend dueño del contenido, ruteo por ecosistema)
**Contrato:** `superadmin/.claude/contracts/docs-internal.md` · ADR-024 de superadmin

## Contexto

ADR-020 dejó abierto qué backend es dueño del contenido. Superadmin (grupojl-control) lo
resolvió con su ADR-024: modelo `DocSpace` por ecosistema, edición con audit y versiones, y
lectura para docs-front por `GET /internal/docs/:ecosystemId/:locale/{navigation|page}`
con `x-internal-api-key`. Faltaba decidir cómo docs-front elige el ecosistema.

## Decisión

1. **docs-front lee de grupojl-control-backend** vía `internalDocsRepository`
   (`lib/docs/internal-repository.ts`), con `fetch` de servidor y tag `docs:<ecosistema>`.
   No usa tRPC: el contrato de superadmin es REST interno con API key, y el principio
   "interno = tRPC" admite esta excepción porque el dueño del contrato es otro repo.
2. **Un ecosistema por deploy**: `DOCS_ECOSYSTEM_ID` (default `welver`). Las URLs siguen
   siendo `/{locale}/docs/...` (ADR-016), sin segmento de ecosistema.
3. **`POST /api/revalidate`** recibe `{ tag: "docs:<eco>" }` de superadmin, valida
   `x-internal-api-key` (`timingSafeEqual`) y expira el tag de inmediato.
4. **Errores (ADR-016):** 404 de superadmin → `null` → 404 público; cualquier otra falla
   → 5xx.
5. Se eliminan `mock-repository.ts` y `lib/docs/mock/`.

## Alternativas descartadas

- **Segmento `/{locale}/docs/{ecosistema}/...`** — cambia las URLs públicas y mezcla en un
  deploy documentación de productos distintos. Un deploy por ecosistema da URLs limpias y
  dominio propio por producto. Si hiciera falta un único portal, se reevalúa.
- **Tomar el ecosistema del host/subdominio** — más implícito y difícil de probar.
- **Clave interna en el cliente o endpoint público de lectura** — fuera de discusión: la
  clave es solo de servidor.

## Consecuencias

**Se gana:** lo que se publica en superadmin aparece sin deploy; un solo origen de contenido.

**Se sacrifica:** las páginas dependen de la disponibilidad de superadmin. Mitigación: la
caché de datos de Next (`revalidate: 3600` + tag) sirve contenido ya leído; la primera
lectura de cada página sí necesita el backend. Las rutas son dinámicas: `next build` ya no
necesita el backend.

**Deuda consciente:**
- Sin vista previa de borradores (DOC-09 en superadmin).
- Sin validación runtime de la respuesta del backend (se confía en el contrato tipado).
- Dockerfile, CI y servicio Railway de docs-front siguen pendientes.
- Variables nuevas en Railway: `DOCS_BACKEND_URL` e `INTERNAL_API_KEY` (misma que superadmin).
  En superadmin: `DOCS_FRONT_INTERNAL_URL` apuntando a este servicio.

## Verificación (2026-10-13)

Probado contra un backend simulado que implementa el contrato (no contra superadmin real):
lectura con la clave, 404 → 404, 500 → 5xx, caché que sirve la copia vieja hasta
`/api/revalidate`, 401 sin clave, 400 con tag inválido, tag desconocido de contenido
descartado y badge renderizado.
