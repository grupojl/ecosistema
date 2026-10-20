# Contrato: canal WhatsApp (sass-front ↔ sass-back ↔ chatia)

> **Estado:** implementado y compilando en los tres repos; **no probado contra Meta** (falta la app: `checklists/meta-whatsapp-app.md`).
> Decisión: `decisions/ADR-025-whatsapp-embedded-signup-sass-front.md`. Plataforma: ADR-024 de ecosistema-ms.

## 1. sass-front → sass-back (tRPC, `whatsapp.*`)

Transporte normal del front: cookie `__session` + header `x-organization-id`. Todo es `ownerProcedure` (solo OWNER de la organización activa).

| Procedure | Input | Output | Notas |
|---|---|---|---|
| `whatsapp.status` (query) | — | `WhatsappConnection \| null` | `null` = sin WhatsApp conectado |
| `whatsapp.connect` (mutation) | `{ code, wabaId, phoneNumberId }` | `WhatsappConnection` | **Step-up** (`REAUTH_REQUIRED` → el front reautentica y reintenta). `wabaId`/`phoneNumberId`: 5–30 dígitos |
| `whatsapp.disconnect` (mutation) | `{ accountId }` | `{ disconnected: true }` | **Step-up** |

`WhatsappConnection = { accountId: string; status: 'CONNECTED' | 'ERROR'; displayPhone: string | null; errorMessage: string | null }`.
Los tipos se **infieren** de `@real/trpc` (ADR-019); no se escriben a mano en el front.

## 2. sass-back → chatia (HTTP interno)

Header `x-internal-api-key` (= `INTERNAL_API_KEY`, el mismo valor en ambos). La organización va en la ruta porque no hay token de usuario.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /internal/whatsapp/:organizationId` | — | `{ success, data: null \| { accountId, displayPhoneNumber, connected, subscribed?, phone?, reason? } }` |
| `POST /internal/whatsapp/:organizationId/embedded-signup` | `{ code, wabaId, phoneNumberId, organizationName, organizationSlug? }` | cuenta pública (sin token) + `subscribed`, `registered` |
| `DELETE /internal/whatsapp/:organizationId/:accountId` | — | `{ success, data: { disconnected: true } }` |

chatia además expone, con usuario (TenantGuard): `POST /api/v1/channel-accounts/whatsapp/embedded-signup` y `GET .../:id/status`.
Un 4xx de chatia llega al usuario con su mensaje; un 5xx o una caída llegan como 503 genérico.

## 3. Meta → chatia (webhook único)

`GET|POST /api/v1/webhooks/whatsapp`: una sola URL para todos los clientes. La firma se valida con `META_APP_SECRET`; cada cambio se enruta
por `metadata.phone_number_id`. Un número desconocido o desconectado se ignora sin fallar el lote. Verify token: `META_WEBHOOK_VERIFY_TOKEN`.
(La ruta con id de número, `/webhooks/whatsapp/:id`, se conserva para cuentas con app propia.)

## Qué NUNCA muestra ni guarda el front

- `accessToken` del cliente ni de la plataforma: lo canjea y guarda **cifrado** chatia; las respuestas de la API no lo incluyen.
- `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `INTERNAL_API_KEY`. Al navegador solo llegan el App ID y el `config_id` (`NEXT_PUBLIC_META_*`).
- Ningún secreto en `localStorage`, query strings, consola ni analytics.

## Estados de la vista

Cargando · vacío (sin WhatsApp) · error (incluye token vencido / WABA sin suscripción / chat IA no disponible). Solo el dueño ve la sección.
