# Contrato: reportes de usuario (front ↔ sass-back ↔ superadmin)

> **Estado:** implementado y compilando (sass-back, contrato `@real/trpc`, sass-front, dashboard-front); migración sin aplicar; superadmin pendiente. Decisión: `decisions/ADR-027-reportes-de-usuario.md`. Norte: `architecture/13-reportes-norte.md`.

## 1. Front → sass-back (tRPC, `feedback.*`)

Transporte normal: cookie `__session` + header `x-organization-id`. La organización sale del contexto validado, nunca del input.

| Procedure | Input | Output | Notas |
|---|---|---|---|
| `feedback.create` (mutation) | `{ message, expected?, module, route, diagnostics? }` | `{ id, status }` | `message` 10–2000 chars. Máx. 10 por usuario por hora (429). El back completa `release`, `traceId`, rol y user agent |
| `feedback.listMine` (query) | `{ page?, limit? }` | `{ data: FeedbackReportSummary[], total }` | Propios; el OWNER recibe los de toda la organización |
| `feedback.getById` (query) | `{ id }` | `FeedbackReport` | 404 si no es de su organización |

`diagnostics` (opcional, solo con consentimiento): `{ consoleErrors?: string[] }` (captura de pantalla: fuera de la v1). El back lo sanea y descarta cualquier clave
que parezca secreto (token, cookie, authorization, password).

`FeedbackReportSummary = { id; module; route; message; expected; status: 'RECEIVED'|'IN_PROGRESS'|'RESOLVED'|'WONT_FIX'; createdAt }`.
Los tipos se **infieren** de `@real/trpc` (ADR-019).

## 2. Superadmin → sass-back (HTTP interno)

Header `x-internal-api-key` (= `INTERNAL_API_KEY`).

| Método y ruta | Query / cuerpo | Respuesta |
|---|---|---|
| `GET /internal/feedback` | `?status&organizationId&module&page&limit&search` | `{ data: InternalFeedback[], total }` |
| `GET /internal/feedback/:id` | — | `InternalFeedback` (incluye `context` y `diagnostics`) |
| `PATCH /internal/feedback/:id` | `{ status?, internalNote? }` | `InternalFeedback` |

`internalNote` nunca llega al front del usuario.

## Qué NUNCA viaja ni se guarda

Tokens, cookies, `Authorization`, cuerpos de request, datos de pago ni secretos de configuración.
