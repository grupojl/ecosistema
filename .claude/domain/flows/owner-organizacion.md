# Flow: Dueño de organización — de login a operar el negocio

> Estado: 🟡 Decisiones cerradas el 2026-10-10 (ver §0). Primera tanda implementada en código el 2026-10-10 (ver §10); la migración de base de datos **está escrita pero no aplicada**
> Servicios: `realsass-sass-front` · `realsass-sass-back` · `realsass-dashboard-front` · `realsass-ecommerce-back` · microservicios de `ecosistema-ms`
> Rol: **OWNER** de una organización
> Fuente: definición del dueño del producto (2026-10-10) + lectura del código a esa fecha

Leyenda de estado: `✅` implementado · `🟡` parcial · `🔲` no existe · `❓` decisión de producto pendiente

---

## 0. Decisiones de producto (cerradas 2026-10-10)

| # | Decisión | Detalle |
|---|---|---|
| D1 | **Organización por defecto** | Todo usuario nuevo recibe una organización automáticamente al primer login. Nombre inicial "Tienda de {nombre}", slug generado y editable después (el cambio de slug cambia la URL pública y avisa) |
| D2 | **Código de afiliado por defecto** | Se asigna al crear el **usuario** (no la organización). Aleatorio, no adivinable, no derivado del id. Independiente de ser dueño |
| D3 | **Una o más organizaciones por usuario** | El usuario tiene **membresías** (usuario ↔ organización con rol OWNER o COLLABORATOR). Hay un tope de organizaciones propias por usuario, configurable por plan |
| D4 | **Organización activa viaja en la URL / header** | La cookie dice *quién sos*; el back valida en cada request que tengas acceso a esa org (`x-organization-id` + `getOrganizationAccess`). Cambiar de org **no reemite la cookie** |
| D5 | **Sesión larga y renovable, no eterna** | Renovación deslizante en cada uso; tope por inactividad (90 días); revocable; reautenticación en acciones sensibles |
| D6 | **Permisos por módulo** | Roles predefinidos (Administrador, Pedidos, Productos, Solo lectura) + personalización por módulo + "Acceso total" |

---

## 1. La regla de este flujo

> **Yo me logueo → tengo una organización → esa organización me da el `organizationId`
> → con ese `organizationId` configuro mi negocio, abro el dashboard e integro gente.**

Todo lo que el dueño puede hacer cuelga del `organizationId`. Sin `organizationId` activo no hay
dashboard, ni webhooks, ni colaboradores.

### Quién entra al dashboard (lista cerrada)

| Actor | Cómo se identifica | Alcance |
|---|---|---|
| **Dueño** (OWNER) | Cookie `__session` + claims `role: OWNER`, `organizationId` | Todo, sin restricciones. Los permisos del owner **nunca se persisten**: los calcula el service (ADR-001) |
| **Colaborador** | Cookie `__session` + invitación aceptada (`status: ACTIVE`) | Solo los módulos que el dueño le habilitó |
| **Microservicios de `ecosistema-ms`** | Credencial de servicio (`INTERNAL_API_KEY`, no Firebase) | Solo la API interna, sin sesión de usuario |

Nadie más. Un usuario logueado **sin** `organizationId` activo no pasa de `/profile`.

---

## 2. Pantallas involucradas

| Pantalla | Front / ruta | Qué resuelve |
|---|---|---|
| Landing + modal de login | sass-front `/` | Entrada. El login es un modal (Google / Apple / Facebook), no una ruta `/login` |
| Perfil del dueño | sass-front `/profile` | Estado de la org, colaboraciones, afiliado, botón "Abrir dashboard" |
| Config de organización | sass-front `/profile/config` | Flags, quotas, temas, plantillas, webhooks |
| Aceptar invitación | sass-front `/invite/[token]` | Entrada del colaborador |
| Dashboard | dashboard-front `/dashboard/*` | Operación de la tienda |

---

## 3. Pasos

### Paso 1 · Login

```
Visitante abre el modal → elige proveedor → popup de Firebase
  → onAuthStateChanged
  → auth.sync (tRPC): upsert del usuario + emite custom claims (ADR-003)
  → getIdToken(true): token fresco con claims
  → POST /auth/session (REST, ADR-004): cookie HttpOnly __session (14 días)
  → auth.me (tRPC): perfil completo
  → el usuario ve su perfil
```

| Estado | |
|---|---|
| ✅ | Flujo feliz implementado |
| 🟡 | `useMe()` se dispara al montar sin esperar a que termine el sync/cookie → posible 401 transitorio |
| 🟡 | `POST /auth/session` no se valida: si falla, el usuario queda "logueado" sin cookie y nadie se entera |
| ❓ | Qué ve el usuario mientras `auth.sync` corre (skeleton / pantalla de "preparando tu cuenta") |

#### Política de sesión (D5)

```
Cookie __session: vida corta (máx. 14 días, límite de Firebase) pero RENOVABLE.
  · Cada visita: si el usuario de Firebase sigue en el navegador, el front recrea la cookie
    (onAuthStateChanged → syncAndLoad). Con la app abierta, refresh proactivo a los 55 min.
  · Mientras el usuario entre al menos una vez cada 90 días, nunca ve un login.
  · Pasados 90 días sin uso → se pide login (tope por inactividad).
  · Mientras la cookie se recrea, NINGUNA consulta autenticada se dispara (evita los 401 de arranque).
Sesión compartida entre fronts (2026-10-16): la cookie __session es la fuente de verdad. El usuario de
  Firebase vive por origen; si falta pero la cookie es válida (login hecho en otro front), el front se
  autentica con auth.me por cookie. Sin refresh proactivo en ese caso: vence a los 14 días.
  Producción: los fronts deben compartir dominio raíz (COOKIE_DOMAIN).
  Arranque rápido (2026-10-16): al cargar una página el perfil sale de la cookie en 1 request (`auth.me`); la
  cadena de Firebase (sync → token → cookie → me) corre en segundo plano y renueva la cookie sin bloquear ni
  cerrar la sesión si falla. En el servidor, `/profile` prefetchea `auth.me` con la cookie usando la MISMA
  queryKey que tRPC React (`[['auth','me'],{ type: 'query' }]`); con otra key el prefetch no se usa.
  Renovación de la cookie acotada (2026-10-16): `POST /auth/session` tiene límite de 10/min por IP, y recargar con F5 ejecutaba
  toda la cadena cada vez → 429 y "preparando la sesión". Ahora la cookie se recrea como máximo cada 30 min por origen
  (`sessionRefreshDue` en localStorage); en una recarga dentro de esa ventana alcanza con `auth.me` por cookie. Si el POST
  falla (429) pero hay una cookie válida previa, la sesión sigue lista. El botón "Dashboard" espera hasta 8 s a la sesión.
  En vivo: cerrar sesión en un front cierra en todos y abrirla en uno abre en los demás (auth.ping al volver a
  la pestaña y cada 30 s; BroadcastChannel entre pestañas del mismo origen). Ver contracts/user-sessions.md.
Revocación:
  · "Cerrar sesión en todos los dispositivos" → revokeRefreshTokens (ya existe en el back).
  · Lista de dispositivos/sesiones activas ✅ modal "Dispositivos" (dashboard y /profile) — ADR-020,
    `contracts/user-sessions.md`: lista, cerrar una o las demás. 🔲 mail de dispositivo nuevo (F3).
Acciones sensibles (reautenticación con StepUpGuard, ya existe en el back):
  · crear/rotar/revocar secretos · alta/baja de webhooks · quitar colaboradores
  · cambiar el slug · eliminar la organización · cambiar plan o datos de facturación
```

### Paso 2 · Organización y código de afiliado por defecto (D1, D2, D3)

```
Primer auth.sync de un usuario nuevo (una sola transacción):
  1. Crea User
  2. Genera su código de afiliado (aleatorio, único)        ← D2
  3. Crea Organization "Tienda de {nombre}" + slug generado  ← D1
  4. Crea la membresía OWNER (usuario ↔ organización)        ← D3
  5. Devuelve el organizationId activo
El usuario aterriza en /profile con su organización ya creada. No se le pide nada antes.
```

| Estado en código (2026-10-10) | |
|---|---|
| ✅ | Alta de usuario: código de afiliado aleatorio (`ref-<10 hex>`) + organización por defecto "Tienda de {nombre}" + Market default, en el primer `auth.sync`. También **repara** cuentas viejas sin organización o sin código |
| ✅ | `organizations.list` y `organizations.create` (tope `MAX_ORGS_PER_USER`, por defecto 3) |
| ✅ | Selector de organización en `/profile`; la activa viaja en `x-organization-id` |
| ✅ | Colaboradores y datos de organización operan sobre la **organización activa**, no sobre "la única" |
| 🟡 | Membresías: se resolvió sin tabla nueva. El dueño es `Organization.userId` (ya no único) y el colaborador es `Collaborator`. Una tabla `Membership` unificada queda para cuando haga falta |
| 🔲 | Edición guiada de nombre/slug (con reautenticación y redirección del slug viejo) |
| 🔲 | Tope de organizaciones **por plan** (hoy un único valor global por variable de entorno) |

> Antes de esta tanda el documento decía que la organización se creaba sola en el primer login. **No era cierto:**
> ningún código la creaba (solo existía un método sin llamadores) y el `registerReferral` recibía los argumentos invertidos.

**Organización adicional (D3):**
```
Selector de organización (navbar/dashboard) → "Crear organización"
  → nombre, país → organizations.create (valida tope del plan)
  → el nuevo organizationId pasa a ser el activo (URL/header, sin tocar la cookie)
```

**Cambio de organización activa (D4):** solo cambia el `organizationId` de la URL/header; el back
revalida el acceso en cada request. Esto reemplaza la idea anterior de reemitir la cookie.

**Slug:** cambiable por el dueño con reautenticación y aviso ("tu URL pública cambiará"); el slug
viejo redirige durante un período (❓ cuánto). Único globalmente; validación de unicidad en vivo.

### Paso 3 · Configurar la organización (todo cuelga de `organizationId`)

Todas estas acciones exigen rol **OWNER** (`ownerProcedure`) salvo que se indique otra cosa.

| Módulo | Qué hace el dueño | Procedures | Estado |
|---|---|---|---|
| **Datos de la org** | Nombre, descripción, logo, website | `organizations.me` / `update` | ✅ |
| **Webhooks** | Alta de endpoint + eventos, test, historial de entregas, baja | `configWebhooks.list/create/remove/test/getLogs` | ✅ |
| **Feature flags** | Activar/desactivar funciones de su org | `configFlags.list/update` | ✅ |
| **Quotas** | Ver consumo y límites (el límite lo cambia el sistema/plan) | `configQuotas.list/updateLimit` | ✅ |
| **Temas** | Listar, crear, activar, borrar | `configThemes.*` | ✅ |
| **Secretos** | Guardar/rotar/revocar claves externas (valor nunca vuelve al front) | `configSecrets.*` | ✅ |
| **Plantillas** | Mails y mensajes | `configTemplates.*` | ✅ |
| **Auditoría** | Ver quién cambió qué | `configAudit.*` | ✅ |
| **Mercados** | Países donde opera (ADR-014) | `markets.*` | ✅ |

### Paso 4 · Abrir el dashboard (SSO)

```
Dueño en /profile → "Abrir dashboard"
  → useDashboardSSO: obtiene token → llama al back → redirige a dashboard-front con el SSO
  → dashboard-front crea su propia sesión y resuelve el tenant por organizationId
```

| Estado | |
|---|---|
| 🟡 | El hook existe; no se probó extremo a extremo contra el dashboard |
| ❓ | ¿El dashboard comparte la cookie `__session` (mismo dominio) o abre sesión propia en producción? En local comparte por ser `localhost` |
| 🔲 | Qué ve el dueño si `NEXT_PUBLIC_DASHBOARD_FRONT_URL` no está configurada (hoy: error por 5 s y vuelve a `idle`) |

### Paso 5 · Integrar colaboradores y darles permisos

```
Dueño → "Invitar colaborador" (email + permisos)
  → collaborators.invite: crea Collaborator (PENDING) + token de un solo uso, vence a los 7 días
  → se envía el email con el link /invite/[token]
Colaborador abre el link
  → collaborators.getInvitationInfo (público): muestra org y permisos que se le ofrecen
  → se loguea (flujo del Paso 1)
  → collaborators.acceptInvitation → status ACTIVE
  → refreshClaims + cookie nueva → accede al dashboard con su alcance
Dueño después
  → collaborators.update (cambiar permisos) · collaborators.remove (REMOVED, soft delete)
```

#### Modelo de permisos

Regla de producto: **permiso por módulo, o "todo".**

| Hoy (ADR-001) | Lo que pide el producto |
|---|---|
| `canViewListings`, `canCreateListings`, `canEditListings`, `canDeleteListings`, `canViewStats`, `canManageLeads`, `canManageCollaborators` | Un permiso por **módulo del dashboard**: Pedidos, Productos, Stock, Pagos, Campañas, Chat IA, Webhooks, Config, Colaboradores… más un atajo **"Acceso total"** |

🔲 **Brecha:** los permisos actuales son de inmobiliaria (`Listings`, `Leads`), no de tienda online.
Hay que redefinir el catálogo de permisos por módulo antes de cablear pantallas (DT-DASH-04).
Propuesta de forma (JSONB, sin migración):

```json
{ "all": false,
  "orders":        { "read": true,  "write": false },
  "products":      { "read": true,  "write": true  },
  "webhooks":      { "read": false, "write": false },
  "collaborators": { "read": false, "write": false } }
```

Reglas:
- `all: true` equivale a todos los módulos en lectura y escritura **excepto** gestionar al dueño.
- Un colaborador **nunca** puede: dar permisos que él no tiene, ni modificar o quitar al dueño, ni gestionar colaboradores sin `collaborators.write`.
- El dueño siempre tiene todo (calculado, no persistido).

### Paso 6 · Operar la tienda desde el dashboard

El dashboard es el único lugar donde se maneja la tienda: pedidos, productos y stock, pagos,
campañas, chat IA, zonas de envío. Cada pantalla verifica **tres cosas** en este orden:

1. Sesión válida (cookie) → si no, 401.
2. `organizationId` activo y acceso a él → si no, 403.
3. Permiso del módulo (si es colaborador) → si no, 403 con mensaje de módulo.

Los **microservicios de `ecosistema-ms`** (chat IA, campañas, pagos, marketing) no usan sesión de
usuario: llaman a la API interna con credencial de servicio y siempre acotados a un `organizationId`.

---

## 4. Catálogo de errores

Cada error tiene un **código estable** que la UI usa para decidir *qué mostrar*, separado del
texto que viene del back. La UI nunca muestra el mensaje crudo del servidor.

### 4.1 Mapeo técnico → experiencia

| Código tRPC | HTTP | Cuándo | `AppError.code` (front) | Comportamiento de UI |
|---|---|---|---|---|
| `UNAUTHORIZED` | 401 | Sin cookie, cookie vencida o revocada | `AUTH` | Intentar renovar la cookie en silencio (1 vez); si falla → modal `SESSION_EXPIRED` |
| `FORBIDDEN` | 403 | Sin acceso a la org o sin permiso de módulo | `FORBIDDEN` | Pantalla "Sin acceso" con módulo y a quién pedírselo |
| `BAD_REQUEST` | 400 | Falta `x-organization-id` o input inválido | `VALIDATION` | Errores por campo (inline); si falta org → ir a `/profile` |
| `NOT_FOUND` | 404 | Org, webhook, invitación o colaborador inexistente | `NOT_FOUND` | Estado vacío con acción de salida |
| `CONFLICT` | 409 | Slug tomado, colaborador ya invitado | `VALIDATION` | Error inline en el campo en conflicto |
| `QuotaExceeded` | 4xx | Se alcanzó un límite del plan | 🔲 sin código propio | Modal "Alcanzaste el límite" con consumo y CTA de plan |
| `TOO_MANY_REQUESTS` | 429 | Throttle (10/min en `/auth/session`, 30/min global) | 🔲 | Aviso con tiempo de espera; botón deshabilitado |
| Red caída | — | Sin conexión / back caído | `NETWORK` | Banner persistente "Sin conexión" + reintento automático |
| `INTERNAL_SERVER_ERROR` | 500 | Falla del servidor | `UNKNOWN` | Mensaje genérico + ID de solicitud (`x-request-id`) para soporte |

🔲 **Brecha:** `AppError` hoy no distingue `QUOTA`, `RATE_LIMIT` ni `EXPIRED`. Hay que ampliar el tipo.

### 4.2 Errores por paso

| Paso | Falla | Código | Mensaje al usuario | Acción |
|---|---|---|---|---|
| 1 Login | Usuario cierra el popup | — (no es error) | Ninguno | Silencio (ya implementado) |
| 1 Login | Popup bloqueado por el navegador | `auth/popup-blocked` | "Tu navegador bloqueó la ventana de acceso" | Instrucciones para permitir |
| 1 Login | Cuenta existe con otro proveedor | `auth/account-exists-with-different-credential` | "Ya tenés una cuenta con este email usando otro método" | Sugerir el proveedor original |
| 1 Login | Firebase sin red | `auth/network-request-failed` | "No pudimos conectarnos" | Reintentar |
| 1 Login | `auth.sync` falla | 5xx | "No pudimos preparar tu cuenta" | Reintentar; no dejar sesión a medias (cerrar sesión de Firebase) |
| 1 Login | `POST /auth/session` falla | 401/429/5xx | "No pudimos iniciar tu sesión segura" | Reintentar; **hoy se ignora** 🟡 |
| 2 Org | Slug ya tomado | `CONFLICT` | "Ese nombre de tienda ya está en uso" | Sugerir alternativas |
| 2 Org | Slug inválido | `BAD_REQUEST` | "Usá minúsculas, números y guiones" | Validación inline |
| 3 Webhooks | URL inválida | `BAD_REQUEST` | "La URL no es válida" | Inline |
| 3 Webhooks | Test falla | — | "Tu endpoint respondió {status}" o "no respondió en {n}s" | Mostrar respuesta y reintentar |
| 3 Webhooks | Entrega agota reintentos (3, backoff exponencial) | — | Alerta persistente en el webhook | Ver §5, `WEBHOOK_FAILING` |
| 3 Secretos | Rotar un secreto en uso | — | "Esta clave la usa {integración}" | Confirmación explícita |
| 4 SSO | Falta URL del dashboard | — | "El dashboard no está disponible por ahora" | Log + alerta interna |
| 4 SSO | Token vencido | `UNAUTHORIZED` | "Tu sesión venció" | Re-login |
| 5 Invitación | Link vencido (>7 días) | `NOT_FOUND`/`EXPIRED` 🔲 | "Esta invitación venció" | Pedir al dueño que reenvíe |
| 5 Invitación | Link ya usado | — | "Esta invitación ya fue utilizada" | Ir al login |
| 5 Invitación | Email distinto al invitado | `FORBIDDEN` | "Esta invitación es para otro email" | Cambiar de cuenta |
| 5 Invitación | Org llegó al máximo de colaboradores | `QuotaExceeded` | "Alcanzaste el máximo de colaboradores de tu plan" | CTA de plan |
| 5 Permisos | Colaborador intenta una acción sin permiso | `FORBIDDEN` | "No tenés permiso para {acción} en {módulo}" | Botón "Pedir acceso" |
| 6 Operar | Org `SUSPENDED` o `BLOCKED` | `FORBIDDEN` 🔲 | "Tu organización está suspendida" | Contacto con soporte |
| 6 Operar | Tienda `PAUSED` | — | Banner "Tu tienda está pausada" | Botón reanudar |
| 6 Operar | Servicio externo caído (chat IA, pagos…) | 5xx | "{Servicio} no está disponible" | Degradación: ocultar el módulo, no romper el resto |

---

## 5. Alertas y notificaciones

Cinco **canales**, cada uno con un propósito. Un mismo evento usa un canal según su gravedad.

| Canal | Cuándo | Persistencia |
|---|---|---|
| **Toast** | Confirmación o error puntual de una acción del usuario | Efímero (4–6 s) |
| **Inline** | Error de validación en un campo | Hasta que se corrige |
| **Banner** | Estado que afecta a toda la sesión u org | Hasta que se resuelve |
| **Modal** | Decisión o bloqueo que exige atención | Hasta que el usuario actúe |
| **Email / webhook** | Eventos fuera de la pantalla | Entrega asíncrona |

### 5.1 Matriz de eventos

| ID | Evento | Quién lo ve | Canal | Severidad | Estado |
|---|---|---|---|---|---|
| `SESSION_EXPIRED` | Cookie vencida y sin posibilidad de renovar (revocada, o >90 días de inactividad) | Cualquiera | Modal "Tu sesión terminó" → login; si se pudo renovar, **silencioso** | Alta | 🟡 renovación al cargar ✅; modal 🔲 |
| `SESSION_REVOKED` | "Cerrar sesión en todos los dispositivos" desde otro equipo | Cualquiera | Modal | Alta | 🔲 |
| `ORG_SWITCHED` | Cambió la organización activa | Dueño/colaborador | Toast con nombre de la org | Info | 🔲 |
| `ORG_LIMIT_REACHED` | Alcanzó el máximo de organizaciones del plan | Dueño | Modal con CTA de plan | Media | 🔲 |
| `SLUG_CHANGED` | Cambió la URL pública | Dueño | Toast + aviso de redirección | Media | 🔲 |
| `SESSION_REFRESHED` | Refresh a los 55 min | Nadie | — (silencioso) | — | ✅ |
| `ORG_CREATED` | Se creó la organización | Dueño | Toast + redirect | Info | 🔲 |
| `ORG_UPDATED` | Datos de la org guardados | Dueño | Toast | Info | ✅ |
| `ORG_SUSPENDED` | Org suspendida o bloqueada | Dueño y colaboradores | Banner (bloquea escritura) | Crítica | 🔲 |
| `STORE_PAUSED` | Tienda pausada | Dueño y colaboradores | Banner | Alta | 🔲 |
| `INVITE_SENT` | Invitación enviada | Dueño | Toast | Info | ✅ |
| `INVITE_EXPIRING` | Invitación vence en 24 h | Dueño | Email + badge en la lista | Media | 🔲 |
| `INVITE_ACCEPTED` | Un colaborador aceptó | Dueño | Toast + email | Info | 🔲 |
| `COLLAB_PERMS_CHANGED` | Cambiaron tus permisos | Colaborador | Toast + refresh de claims | Media | 🔲 |
| `COLLAB_REMOVED` | Te quitaron el acceso | Colaborador | Modal en el próximo request | Alta | 🔲 |
| `QUOTA_80` | Consumo ≥ 80 % de un límite | Dueño | Banner + email | Media | 🔲 |
| `QUOTA_100` | Límite alcanzado | Dueño y quien intenta la acción | Modal | Alta | 🟡 (el back rechaza; la UI no lo explica) |
| `WEBHOOK_TEST_OK` / `_FAIL` | Resultado del test | Dueño | Toast con detalle | Info / Media | ✅ |
| `WEBHOOK_FAILING` | N entregas fallidas seguidas | Dueño | Banner en la pantalla de webhooks + email | Alta | 🔲 |
| `WEBHOOK_DISABLED` | Se desactiva por fallas persistentes | Dueño | Email + banner | Alta | ❓ ¿se desactiva solo? |
| `SECRET_ROTATED` | Se rotó una clave | Dueño | Toast + auditoría | Info | ✅ |
| `FLAG_CHANGED` | Cambió un flag | Dueño | Toast + auditoría | Info | ✅ |
| `RATE_LIMITED` | 429 | Quien dispara | Toast con espera | Media | 🔲 |
| `OFFLINE` | Sin conexión | Cualquiera | Banner persistente | Alta | 🔲 |
| `SERVICE_DEGRADED` | Microservicio caído | Dueño y colaboradores | Banner por módulo | Media | 🔲 |

### 5.2 Reglas de comportamiento

1. **Una acción del usuario → un solo toast.** No se apilan toasts por la misma causa.
2. **Banner y modal nunca conviven** sobre el mismo evento: gana el de mayor severidad.
3. **Todo error con causa externa muestra el `x-request-id`** (copiable) para soporte.
4. **Los eventos de seguridad** (`SESSION_EXPIRED`, `COLLAB_REMOVED`, `ORG_SUSPENDED`) nunca se descartan solos.
5. **Nada se pierde en silencio:** cada fallo en segundo plano (refresh de cookie, entrega de webhook) deja huella visible para el dueño, no solo en logs.
6. **Auditoría:** todo cambio de configuración, permisos y secretos queda en `config-audit` con actor, org y hora.

### 5.3 Centro de notificaciones (propuesta para la UI)

Una campana en el dashboard con el historial de los eventos de §5.1 de los últimos 30 días:
título, severidad, hora, módulo de origen y acción directa. Lo no leído se cuenta en un badge.
❓ Requiere un modelo `Notification` por `organizationId` (+ destinatario) que hoy no existe.

---

## 6. Estados de la organización y su efecto

| Estado | Dueño | Colaborador | Storefront |
|---|---|---|---|
| `OrgStatus.ACTIVE` + `StoreStatus.ACTIVE` | Todo | Según permisos | Online |
| `OrgStatus.ACTIVE` + `StoreStatus.PAUSED` | Todo | Según permisos | 404 / "tienda en pausa" |
| `OrgStatus.SUSPENDED` | Solo lectura + soporte | Solo lectura | Offline |
| `OrgStatus.BLOCKED` | Solo `/profile` y soporte | Sin acceso | Offline |
| Sin organización | Solo `/profile` | — | — |

---

## 7. Invariantes

- Todo dato del dashboard está acotado a un `organizationId`; ningún query lo omite.
- Solo el OWNER gestiona webhooks, secretos, flags, temas y colaboradores (salvo permiso explícito).
- Los permisos del OWNER se calculan, no se guardan.
- La cookie `__session` identifica a la persona, **no** a la organización: el acceso a cada organización se valida en el back en cada request (D4). Cambiar de org o de permisos no exige reemitirla; revocar un acceso surte efecto en el siguiente request.
- Una sesión nunca vive más de 90 días sin actividad y siempre es revocable (D5).
- Todo usuario tiene código de afiliado y al menos una organización desde su primer login.
- Los secretos nunca viajan al navegador, ni cifrados ni en claro.
- Una invitación se usa una sola vez y vence a los 7 días.
- Un colaborador no puede escalar privilegios ni modificar al dueño.
- Los microservicios nunca operan sin `organizationId` ni con sesión de usuario.
- Ningún error técnico llega crudo al usuario: siempre pasa por el catálogo de §4.

---

## 8. Decisiones abiertas

Cerradas el 2026-10-10: creación automática de la organización (D1), código de afiliado por defecto (D2),
varias organizaciones por usuario (D3), organización activa en la URL (D4), sesión deslizante (D5),
permisos por módulo (D6). Quedan:

| # | Pregunta | Impacto |
|---|---|---|
| 1 | Catálogo definitivo de módulos y de roles predefinidos (D6) | Paso 5, DT-DASH-04 |
| 2 | Tope de organizaciones por usuario: ¿cuántas en el plan gratuito? | D3, `ORG_LIMIT_REACHED` |
| 3 | ¿Cuánto tiempo redirige el slug viejo tras un cambio? | Paso 2 |
| 4 | ¿Webhooks fallidos se desactivan solos? ¿tras cuántas fallas? | `WEBHOOK_DISABLED` |
| 5 | ¿Hay planes? ¿qué límites trae cada uno? | Quotas y CTAs |
| 6 | ¿Notificaciones por email: qué servicio las envía? | §5 |
| 7 | ¿Dashboard y sass-front comparten cookie en producción (mismo dominio raíz) o sesión propia? | Paso 4 |
| 8 | ¿Qué hace el dueño con sus organizaciones si deja la plataforma (transferir / eliminar)? | D3 |

## 10. Implementado el 2026-10-10 (primera tanda)

**Back (`realsass-sass-back`, `@real/auth-server`)**
- Middleware tRPC: lee la cookie `__session` (`verifySessionCookie`) cuando no hay Bearer (ADR-004).
- `schema.prisma`: `Organization.userId` deja de ser único; `User.organizations[]`. Migración `20261010150000_multi_org_per_user` (**sin aplicar**).
- `AuthService.syncUser`: `ensureDefaults` (afiliado + organización por defecto), claims OWNER para organizaciones propias, `registerReferral` con argumentos en orden.
- `getOrganizationAccess` valida contra la base por request (D4).
- `organizations.list/create/me/update` y colaboradores sobre la organización activa.
- Traducción de excepciones de Nest a códigos tRPC + `data.appCode` (`QUOTA_EXCEEDED`) y `data.quota` (catálogo §4.1).

**Front (`realsass-sass-front`)**
- `createSessionCookie` verifica la respuesta; `auth.sync` falla de forma visible.
- `sessionReady`: las consultas tRPC autenticadas esperan a que la cookie esté creada (adiós 401 de arranque).
- Organización activa persistida (`localStorage`) y enviada como header; selector y alta en `/profile`.

**Verificado (primera tanda):** typecheck de sass-back, ecommerce-back, sass-front y dashboard-front; `pnpm contracts`.
**Confirmado en ejecución (logs del 2026-10-10):** migración aplicada; `auth.sync` crea la organización por defecto ("Tienda de {nombre}") y emite claims OWNER; `POST /auth/session` 200; `auth.me` 200 con la cookie.

## 10 bis. Segunda tanda (2026-10-10): entrar al dashboard y ver el ecommerce

Problema de partida: el botón "Dashboard" llamaba a `POST /api/v1/auth/firebase-sso` (404). Al seguir el hilo aparecieron más piezas rotas:

| Hallazgo | Arreglo |
|---|---|
| El front pedía `/api/v1/auth/firebase-sso` y el back lo exponía en `/auth/firebase-sso`; además era un stub que solo redirigía y esperaba otro body | Se eliminó. SSO por tRPC: `auth.createDashboardSso` (identidad desde la cookie) |
| El dashboard autenticaba con el `AuthProvider` viejo de `@real/auth-client`: llamaba a `POST /api/v1/auth/sync` (no existe) y esperaba `profile.tenants` (no existe) → habría cerrado la sesión en bucle | `AuthProvider` reescrito con el flujo real: `auth.sync` → cookie → `auth.me`; mapea organizaciones y colaboraciones a `tenants`; `isLoading` cubre todo el arranque |
| El guard global `FirebaseAuthGuard` solo leía Bearer: `DELETE /auth/session` (logout) y cualquier REST autenticado devolvían 401 con la cookie | El guard acepta Bearer o cookie `__session` |
| `/internal/*` (superadmin) no tenía `@Public()`: el guard global lo rechazaba antes de llegar a `InternalApiKeyGuard` | `@Public()` en los controllers internos |
| ecommerce-back verificaba el acceso a la organización reenviando el Bearer del usuario al sass-back; con cookie no hay Bearer | Nuevo `GET /internal/access/:orgId/:uid` con `x-internal-api-key`; ecommerce-back lo usa |
| ecommerce-back no tenía `cookie-parser`: no podía leer `__session` | Agregado (`catalog:`) |
| `trpcGetMe` del sass-front leía `result.data.json`; el router no tiene transformer → siempre `null`, el perfil del contexto nunca cargaba | Lee `result.data` |
| `trpcSyncUser` mandaba `{json: input}`: el código de referido (`?ref=`) nunca llegaba al back | Body = input |
| `.env.local` del dashboard trae `NEXT_PUBLIC_ECOMMERCE_API_URL` con `/api/v1` → `/api/v1/api/v1/trpc` | El provider tolera el sufijo |

**Confirmado en ejecución:** `GET /organizations/public/by-slug/<slug>` devuelve la tienda con `ecommerceEnabled: true`; `/internal/access/...` responde 401 sin clave y 200 con clave.
**Sin probar de punta a punta:** el recorrido completo en navegador (perfil → Dashboard → sesión → Tienda), porque requiere un login real de Google. Ver el checklist de la respuesta de la sesión.

## 10 ter. Tercera tanda (2026-10-10): claves y datos sensibles (Paso 3)

El dashboard pasa a ser un **subdominio** del sass-front: la cookie `__session` se emite con `Domain` del dominio raíz y viaja entre ambos
(cierra la decisión abierta #7; se configura con la variable `COOKIE_DOMAIN`, ya soportada en `SessionService`).

Al construir la pantalla de claves se encontró que la capa de datos sensibles **no funcionaba y tenía fallas de seguridad**:

| Hallazgo | Gravedad | Arreglo |
|---|---|---|
| `rotate`/`revoke` de secretos y `remove` de webhooks operaban por id **sin verificar la organización** (IDOR: un dueño podía tocar claves ajenas) | Crítica | Todas las operaciones por id exigen `organizationId`; un id ajeno es "no encontrado" |
| `configFlags.update` aceptaba flags **globales**: un dueño podía cambiar un flag que afecta a todos los tenants | Alta | Solo flags de la propia organización |
| Los webhooks se creaban con `secretHash: ''`: la firma HMAC usaba una **clave vacía** (cualquiera podía falsificarla) | Alta | Secreto `whsec_…` aleatorio, cifrado AES-256-GCM, mostrado una sola vez; rotable |
| El secreto/URL del webhook viajaba dentro del job de **Redis** (servicio externo) | Media | El job lleva solo el id; el processor lee y descifra de la base |
| Webhooks sin validación de destino: **SSRF** (`http://169.254.169.254`, `localhost`, redes internas) | Alta | `assertPublicHttpUrl`: https + IP pública, al crear y en cada entrega; sin redirects. `WEBHOOK_ALLOW_PRIVATE=true` solo en desarrollo |
| Secretos: se guardaba solo el texto cifrado, **sin iv ni tag** (irrecuperable) y las columnas obligatorias faltaban → no se podían ni crear | Alta | Se persisten `valueIv`, `valueTag` y una pista de 4 caracteres |
| La pista de un secreto eran sus **primeros** 4 caracteres (filtraba material) | Media | Últimos 4, y solo si el valor tiene más de 8 |
| El step-up leía solo el Bearer: con cookie siempre fallaba | Media | Lee Bearer o cookie; `appCode: REAUTH_REQUIRED`; el front reautentica con el proveedor y reintenta |
| El botón "Probar" encolaba a todos los webhooks de la org filtrando por evento `test` (no llegaba al elegido) | Baja | `dispatchTo` al webhook puntual |
| `/profile/config` no tenía acceso desde el perfil, ignoraba la organización activa y el botón "Agregar" webhook creaba uno vacío inválido | Media | Botón "Configuración"; usa la org activa; formulario real |

**Pantalla nueva** (`/profile/config`): sección *Webhooks* (crear, probar, ver entregas, rotar secreto, eliminar) y *Claves y secretos* (crear, rotar, revocar). Valor siempre en campo `password`, jamás devuelto por el servidor; confirmación de identidad en cada acción sensible.

**Pendiente de esta tanda:** webhooks existentes creados antes de este cambio quedan **sin clave de firma** y no envían hasta que se rote su secreto (la UI lo avisa); tests (DT-TEST-01); decisión sobre desactivar webhooks con fallas persistentes (#4); step-up para quitar colaboradores.

## 9. Trabajo técnico que se deduce de este flujo

| Prioridad | Tarea | Ref. |
|---|---|---|
| ✅ | ~~Validar `POST /auth/session`~~ (se valida; falta **mostrar** el aviso al usuario) | Paso 1 |
| ✅ | ~~`useMe` y consultas esperan al fin del login~~ (`sessionReady`) | Paso 1 |
| 🟡 | Validar acceso por request (D4): hecho en el back. Los custom claims se siguen emitiendo porque `ecosistema-ms` los consume (ADR-003) | D4 |
| 🟡 | Membresías: resuelto sin tabla nueva (ver Paso 2) | D3 |
| 🟡 | Alta de usuario: implementada, pero **no en una única transacción** (usuario → organización → market) | D1, D2 |
| 🟡 | `organizations.create` + selector hechos; falta el tope **por plan** | D3 |
| P1 | Renovación deslizante de la cookie y tope de 90 días de inactividad | D5 |
| 🟡 | Sesiones/dispositivos: lista (F1) y revocar por sesión (F2) hechas; falta el mail de dispositivo nuevo (F3) — ADR-020 | D5 |
| P1 | Reautenticación (`StepUpGuard`) en acciones sensibles listadas en el Paso 1 | D5 |
| P1 | Permisos por módulo + roles predefinidos + "Acceso total" (D6) | Paso 5 |
| P1 | Ampliar `AppError` (`QUOTA`, `RATE_LIMIT`, `EXPIRED`, `SUSPENDED`) y un handler global de tRPC | §4 |
| P2 | Capa de notificaciones (toast, banner, modal) con los IDs de §5.1 | §5 |
| P2 | Modelo `Notification` + centro de notificaciones | §5.3 |
