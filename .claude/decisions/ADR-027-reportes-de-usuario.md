# ADR-027: Reportes de usuario ("algo falló") con triage en superadmin

**Fecha:** 2026-10-28
**Estado:** Aceptado (2026-10-28). **Implementado y compilando** (pasos 1–8 y 10); falta aplicar la migración `20261028120000_feedback_reports` y el paso 9 (superadmin, otro repo).

## Contexto

Hoy un usuario que encuentra un bug no tiene dónde reportarlo desde el producto; el equipo se entera por fuera y sin contexto técnico.
Se busca un referente mundial que lo haya resuelto bien para fijarlo como norte (`architecture/13-reportes-norte.md`).
Superadmin (grupojl-control) ya consume `/internal/*` de sass-back con `INTERNAL_API_KEY` (ADR-013), y ya existe el patrón de
funcionalidad por organización con tRPC + permisos (ADR-025).

## Decisión

1. **Norte:** Sentry User Feedback (reporte atado al evento técnico) + Apple Feedback Assistant (consentimiento e ID de seguimiento) + Shopify (contexto de organización/módulo).
2. **`realsass-sass-back` es dueño del modelo** `FeedbackReport` y de su ciclo de estados. Se guarda en su base.
3. **Front → back por tRPC** (`feedback.*`); **superadmin → sass-back por `/internal/feedback*`** (lee y cambia estado/nota). Sin pushes ni cliente nuevo.
4. **Contexto automático** adjunto al reporte y diagnóstico solo con consentimiento (ver norte, pilares 1–2).
5. **Quién reporta:** cualquier miembro autenticado de la organización (OWNER y COLLABORATOR). Ve sus reportes; el OWNER ve los de toda la org.

## Alternativas descartadas

- **Integrar Sentry/un SaaS externo directo** — saca datos de tenants fuera del ecosistema y no se integra con el triage de superadmin.
- **Push de sass-back a superadmin** — agrega un canal y reintentos; el pull de ADR-013 ya existe y es más simple.
- **Modelo propio en superadmin** — superadmin no conoce el tenant ni valida roles; el dato nace en sass-back.

## Consecuencias

Se gana un canal de soporte con contexto, consistente con ADR-013/025. Se acepta: una tabla más en sass-back, un controller interno más,
y la deuda de decidir retención de reportes y de adjuntos (pregunta abierta 2).

## Plan de implementación (dónde se hace cada cambio)

| # | Repo / ruta | Cambio |
|---|---|---|
| 1 | `realsass-sass-back/prisma/schema.prisma` + migración | modelo `FeedbackReport` (id, organizationId, userId, módulo, ruta, release, traceId, mensaje, esperado, `context` JSON, estado, nota interna, timestamps) |
| 2 | `realsass-sass-back/src/feedback/` | `feedback.module/service` (crear, listar propios/org, saneo de `context`: descarta secretos) |
| 3 | `realsass-sass-back/src/trpc/routers/feedback.router.ts` + `app-router.ts` | `feedback.create`, `feedback.listMine`, `feedback.getById`; organización siempre del contexto validado, nunca del input; rate limit |
| 4 | `realsass-sass-back/src/internal/feedback.internal.controller.ts` | `GET /internal/feedback`, `GET /:id`, `PATCH /:id` (estado + nota) con `InternalApiKeyGuard` |
| 5 | `packages/trpc` | exportar el contrato (build `@real/trpc`, ADR-019); tipos inferidos |
| 6 | `realsass-sass-front/features/feedback/` | botón "Informar un problema" + hoja/modal con vista previa del diagnóstico y lista de "Mis reportes" |
| 7 | `realsass-dashboard-front/features/feedback/` | mismo botón para colaboradores |
| 8 | `packages/ui` | componente de reporte compartido (tokens de ADR-024, objetivo táctil ≥44 px) |
| 9 | superadmin (otro repo) | cola de triage que consume `/internal/feedback*`; fuera del alcance de este repo |
| 10 | `.claude/contracts/user-feedback.md`, `roadmap/*`, `services/*` | mantener el contrato y el snapshot al implementar |

Orden: 1 → 2 → 3 → 5 (`pnpm contracts`) → 6/7/8 → 4 → 9.

## Preguntas abiertas (no se inventan respuestas acá)

1. ¿Los colaboradores pueden ver los reportes de otros colaboradores de la misma org o solo el OWNER? (propuesta: solo los propios + OWNER ve todos).
2. Retención de reportes y de adjuntos (captura/consola): ¿cuánto tiempo y dónde se guardan los binarios?
3. ¿Notificar al usuario cuando el estado cambia (email/in-app) o solo mostrarlo en la lista?
4. Cómo se obtiene el `traceId`: depende de la observabilidad vigente (`ADR-015-observabilidad-welver.md`).

## Referencias

`architecture/13-reportes-norte.md` · `contracts/user-feedback.md` · `ADR-013-superadmin-integration.md` · `ADR-025-whatsapp-embedded-signup-sass-front.md` · `ADR-019-contratos-trpc-desde-dist.md` · `ADR-024-ui-ux-adaptable.md`
