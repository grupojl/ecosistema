# Puertos locales — grupojl-control (Super Admin)

Cada repo del ecosistema tiene un rango propio para que no se pisen al correr todo en local.

## Rangos

| Repo | Rango | Estado |
|------|-------|--------|
| superadmin (grupojl-control) | 3000–3009 | en uso |
| ecosistema-ms | 3010–3019 | asignado |
| ecosistema (welver) | 3020–3029 | asignado |

## Superadmin (3000–3009)

| Servicio | Puerto | Variable / config |
|----------|--------|-------------------|
| grupojl-control-frontend (Next.js) | 3000 | `next dev -p 3000` |
| grupojl-control-backend (NestJS) | 3001 | `PORT=3001` |
| (libres) | 3002–3009 | reservados para nuevos servicios del superadmin |

El frontend llama al backend con `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001`.
El backend permite CORS desde `ALLOWED_ORIGINS=http://localhost:3000`.

# Puertos del monorepo ecosistema-ms

## Reparto entre ecosistemas (HTTP)

| Ecosistema | Rango |
|---|---|
| superadmin | 3000 – 3010 |
| **ecosistema-ms** | **3010 – 3020** |
| ecosistema | 3020 – 3030 |

El rango HTTP 3010–3020 solo tiene 10 puertos y este monorepo necesita 12 (6 servicios × HTTP + gRPC). Por eso el gRPC va en una familia aparte, **5010–5015**, siempre HTTP + 2000.

## Puertos por servicio

| Servicio | HTTP | gRPC | Acceso |
|---|---|---|---|
| chatia-backend | 3010 | 5010 | HTTP público (REST + WebSocket) |
| pasarelapagos-backend | 3011 | 5011 | HTTP público (REST + webhooks de proveedores) |
| analytics-backend | 3012 | 5012 | HTTP interno (REST + SSE `/sse/events`) |
| notificaciones-backend | 3013 | 5013 | HTTP interno (REST preferencias) |
| workers-backend | 3014 | 5014 | HTTP interno (`/health`, `/metrics`, `/api/v1/dlq`) |
| marketing-backend | 3015 | 5015 | HTTP público (REST + `/internal/*` para superadmin) |

Libres dentro del rango: HTTP 3016–3019 y gRPC 5016–5019.

## URLs en local

| Servicio | HTTP | gRPC |
|---|---|---|
| chatia | http://localhost:3010 | localhost:5010 |
| pasarelapagos | http://localhost:3011 | localhost:5011 |
| analytics | http://localhost:3012 | localhost:5012 |
| notificaciones | http://localhost:3013 | localhost:5013 |
| workers | http://localhost:3014 | localhost:5014 |
| marketing | http://localhost:3015 | localhost:5015 |

Healthcheck de cada servicio: `/health`.

## Quién llama a quién (gRPC)

| Servicio | Variable | Valor local |
|---|---|---|
| chatia | `ANALYTICS_GRPC_URL` | `localhost:5012` |
| chatia | `NOTIF_GRPC_URL` | `localhost:5013` |
| chatia | `WORKERS_GRPC_URL` | `localhost:5014` |
| pasarelapagos | `CHATIA_GRPC_URL` | `localhost:5010` |
| notificaciones | `CHATIA_GRPC_URL` | `localhost:5010` |
| workers | `CHATIA_GRPC_URL` | `localhost:5010` |
| workers | `NOTIF_GRPC_URL` | `localhost:5013` |
| workers | `ANALYTICS_GRPC_URL` | `localhost:5012` |

analytics y marketing no llaman a otros servicios por gRPC.
`PAGOS_GRPC_URL` (default `localhost:5011`) existe en `packages/grpc-client`.

En Railway el formato es `<servicio>.railway.internal:<puerto gRPC>`; el puerto debe coincidir con el `GRPC_PORT` del servicio destino.

## Dónde están definidos

- `PORT` y `GRPC_PORT`: `<servicio>/.env`, `.env.example` y default en `src/main.ts`.
- Defaults de clientes gRPC: `packages/grpc-client/src/*`, `notificaciones-backend/src/queue/dlq/dlq.module.ts`, `workers-backend/src/core/jobs/jobs.module.ts`.
- Docker: `ENV PORT`, `EXPOSE` y `HEALTHCHECK` en `<servicio>/Dockerfile`.
- Documentación: `.claude/CLAUDE.md`, `.claude/conventions/entorno.md`, `.claude/infrastructure/environments.md`.

## Infraestructura local compartida

| Recurso | Dirección |
|---|---|
| PostgreSQL | `localhost:5432` (usuario `postgres`, una base por servicio) |
| Redis | `localhost:6379` |


Voy a revisar los controllers y la autenticación de cada servicio para armarte la guía de consumo.

  Searched for 8 patterns, read 14 files

Ya revisé los controllers y los guards. Esto es lo que usa el otro ecosistema (welver, mexus, manzana) para consumir ecosistema-ms.
agos  │ :3011 │ /api/docs │
├────────────────┼───────┼───────────┤
│ analytics      │ :3012 │ /api/docs │
├────────────────┼───────┼───────────┤
│ notificaciones │ :3013 │ /api/docs │
├────────────────┼───────┼───────────┤
│ workers        │ :3014 │ /api/docs │
├────────────────┼───────┼───────────┤
│ marketing      │ :3015 │ /api/docs │
└────────────────┴───────┴───────────┘

Los 6 servicios exponen Swagger en /api/dotiene su propia URL pública.

1. Onboarding (una sola vez por ecosistema)

El otro ecosistema se registra en chatia con la clave de plataforma:

POST {CHATIA}/api/v1/ecosystems
x-platform-admin-key: <PLATFORM_ADMIN_KEY>
Content-Type: application/json

{ "firebaseProjectId": "welver-prod", "nam

Si no se registra, chatia rechaza con 403  Los demás endpoints de ese controller sonGET /api/v1/ecosystems, PATCH /:id/config y DELETE /:id, todos con el mismo header.

2. Autenticación

Hay tres modos, según el servicio.

A. Token Firebase del otro ecosistema (chatia, y pasarela por SSO)
Authorization: Bearer <firebase-id-token>
x-organization-id: <orgId>
x-market-country: AR        # opcional, solo chatia
El backend del otro ecosistema (el "sass-back") tiene que emitir estos custom claims en el token
(TenantClaimsSchema):
{
  "organizationId": "org_1",
  "organizationName": "Acme",
  "organizationSlug": "acme",
  "role": "OWNER|ADMIN|MEMBER|VIEWER",
  "permissions": { "chat": { "canRead": tr
}
- claims.organizationId tiene que coincidir con el header x-organization-id. Si no, devuelve 403.
- chatia deriva el ecosystemId del campo aectId registrado).
- Para pasarela, los claims son productPermissions.payments y organizations[].

B. API key server-to-server (solo pasarela)
x-api-key: pk_<prefix>_<random>
En este modo la org queda fijada por la ke y escritura. Las keys se gestionan enPOST|GET /tenants/me/api-keys y DELETE /tenants/me/api-keys/:keyId.

C. Interno / superadmin
x-internal-api-key: <INTERNAL_API_KEY>
Se usa en las rutas /internal/*. Es la misma key en todos los servicios y solo debe usarla el superadmin, no el cliente del otro ecosistema.

3. Endpoints principales

chatia (:3010), con Bearer + x-organization-id

GET/POST        /api/v1/conversations     /takeover, /release, /resolve, /tags)
GET             /api/v1/conversations/:id/messages ; /api/v1/messages/stats
GET/PATCH       /api/v1/contacts ; /contac
CRUD            /api/v1/projects ; /api/v1/agents ; /api/v1/channel-accounts/:id/ai-config
POST/GET/DELETE /api/v1/faq/knowledge-basey
POST            /api/v1/assistant/chat ; GET|PUT /api/v1/assistant/config/:projectId
GET/PATCH       /api/v1/notifications ; /channel-accounts (CRUD + rotate-token)

Públicos, sin auth (para embeber en la web del otro ecosistema):
GET  /widget/:projectSlug/config
POST /widget/:projectSlug/chat           {: "...", "sessionId"?: "uuid" }
GET  /widget/:projectSlug/session/:userId
GET  /widget/:projectSlug/snippet.js     → <script src="..."> y listo
Webhooks de canales: GET|POST /webhooks/:c

pasarelapagos (:3011), con API key o Bearer + x-organization-id

POST /payments
x-api-key: pk_...
idempotency-key: <uuid>          # obligat

{ "amountMinor": 150000, "currency": "ARS"
  "method": "card|wallet|bank_transfer|cash_voucher|pix|qr",
  "description"?: "...", "customerId"?: ".ta"?: {"k":"v"} }

GET  /payments?status=CAPTURED&page=1&limit=20
GET  /payments/:id
POST /payments/:id/refund    { "amountMinor"?: 5000, "reason"?: "..." }   # sin amountMinor = reembolso total
- amountMinor va en la unidad mínima (centavos).
- Estados: PENDING · AUTHORIZED · CAPTURED · FAILED · CANCELLED · REFUNDED · PARTIALLY_REFUNDED.
- Los proveedores (MercadoPago, Stripe, dLocal, Conekta) llaman a POST /webhooks/:providerId.

notificaciones (:3013)

POST /api/v1/notifications        → 202 (encola)
{ "ecosystemId": "...", "organizationId":
  "channel": "WHATSAPP|EMAIL|PUSH", "templateKey": "...",
  "payload": { ... }, "idempotencyKey"?: "..." }

GET  /api/v1/notifications/:id/status
GET  /api/v1/notifications/stats?ecosystemId&organizationId&from&to&channel?
GET/PUT /api/v1/preferences/:contactId[/:channel]                                                               
analytics, marketing y workers                                                                                  
analytics:  GET /api/v1/analytics/live (SSE) ; /live/stats                                                      keting:  /api/v1/campaigns (+ /:id/metration-rules) ; /api/v1/ad-accounts
workers:    /api/v1/campaigns (+ /:id/dispatch) ; GET /api/v1/jobs/:jobId/status ; /api/v1/dlq                  
4. gRPC (servicio a servicio)
                                                                                                                re servicios se prefiere gRPC (chatia :cs :5012, notificaciones :5013, workers:5014, marketing :5015). Los clientes ya están en packages/grpc-client. Si el otro ecosistema es un backend Nest, puede usarlos en vez de HTTP. Los contratos están en .claude/contracts/grpc-contracts.md.
                                                                                                                as que tenés que saber
                                                                                                                modules/welver, modules/mexus y modulesen GET /api/v1/{welver|mexus|manzana}/ping,que devuelve { ecosystemId, status } y sirve para validar la autenticación. Hoy no tienen lógica propia y el otro ecosistema consume los endpoints c
2. notifications.controller.ts en notificaciones no tiene guard. Aunque declara @ApiBearerAuth(), no vi @UseGuards y confía en que el body traiga ecosystemId y organizationId. Si se expone públicamente, cualquiera puede encolar notificaciones o leer stats de cualquieolo por red privada o ponerle un guardantes de abrirlo. No lo verifiqué en runtime.
3. Dev mode. En chatia, con NODE_ENV != production y sin Firebase configurado, basta con el header x-organization-id y se asume el ecosistema dev. No sirve para pruebas reales de integración.
4. Contrato HTTP sin documentar. .claude/contracts/inter-service-http.md marca "welver → ecosistema-ms" como
   "pendiente de documentar" (⚠️). Puedo e





# Puertos — ecosistema (rango 3020–3029)

| Servicio | Puerto |
|---|---|
| realsass-sass-back | 3020 |
| realsass-sass-front | 3021 |
| realsass-dashboard-front | 3022 |
| real-ecommerce-front | 3023 |
| realsass-ecommerce-back | 3025 |

## Infra local (docker-compose)

| Servicio | Puerto |
|---|---|
| postgres-back (`realsass_back_db`) | 5432 |
| postgres-ecommerce (`realsass_ecommerce_db`) | 5433 |
| redis | 6379 |

## Infraestructura local (docker-compose)

| Servicio | Puerto host |
|----------|-------------|
| PostgreSQL | 5434 |
| Redis | 6380 |

## Notas

- La asignación por servicio dentro de `ecosistema-ms` y `ecosistema` la definió el superadmin: cada uno de esos repos tiene que configurar su `PORT` con el valor de esta tabla.
- Railway no usa estos puertos: cada servicio toma el `PORT` que inyecta Railway. El `Dockerfile` del backend sigue con `PORT=4000` por defecto.
- Las URLs `*.railway.internal` de producción no cambian.
