# Ecosistema Real — Documentación de arquitectura

> Este directorio es la memoria persistente del proyecto. Antes de implementar
> cualquier feature, se consulta esta documentación. No se redefine desde cero
> lo que ya está decidido acá.

## Resumen de una línea

SaaS multi-tenant donde cada organización gestiona su negocio (catálogo, stock,
órdenes, config, colaboradores) a través de 3 frontends Next.js sobre 2 backends
NestJS compartidos, con auth/tenant resuelto una sola vez y contrato tipado
end-to-end vía tRPC.

## Principio de comunicación — NO NEGOCIABLE

> **Todo lo interno se comunica via tRPC (o gRPC cuando aplique).
> REST solo se expone cuando hay una API pública para consumidores externos.**

Esto aplica sin excepción a:
- Front → Back: tRPC
- Back → Back: tRPC HTTP o gRPC
- Server Components → Back: tRPC server caller (no fetch manual)
- Client Components: rehidratan desde Server Components, no hacen fetch propio

REST se usa ÚNICAMENTE para:
1. APIs públicas para consumidores externos (terceros, integraciones)
2. Webhooks inbound de sistemas externos (Stripe, couriers, etc.)
3. `POST /auth/session` + `DELETE /auth/session` — bootstrap de cookies HttpOnly
   (excepción técnica: tRPC no puede setear headers Set-Cookie, ADR-004)
4. `GET /health` — healthcheck de Railway

**Cualquier fetch manual o endpoint REST interno es un bug de arquitectura.**

## Modelo de rendering — Next.js App Router

```
Server Component
  → createServerCaller() tRPC (sin React, sin hooks)
  → renderiza HTML con datos
  → pasa datos via props a Client Components

Client Component
  → rehidrata con useQuery() misma queryKey que el server prefetch
  → NUNCA hace fetch propio al back
  → NUNCA llama REST directamente
```

## Contrato vs snapshot

Antes de editar cualquier archivo de esta carpeta, identificar a qué grupo pertenece.

### 🔒 No modificables de base (contrato)

Responden a **"¿cómo debería ser esto?"**. Son la fuente de verdad no negociable.
Se editan solo por decisión explícita de arquitectura, nunca para que "cuadren"
con una desviación del código real.

- `architecture/` — capas, principios, reglas duras
- `contracts/` — shapes de tenant-context, organization-access, routers tRPC
- `decisions/ADR-*.md` — decisiones tomadas e inmutables

### 🔄 Dinámicos (snapshot del estado actual)

Responden a **"¿cómo está esto hoy?"**. Se actualizan con cada sesión de trabajo.

- `roadmap/sprints.md` — estado de sprints
- `roadmap/deuda-tecnica.md` — deuda pendiente
- `services/*.md` — estado actual de cada servicio

## Stack canónico

**Backend (2 servicios hoy, 6 en roadmap):**
Node.js · TypeScript strict · NestJS · Prisma ORM · PostgreSQL · Redis · pnpm workspaces · Docker

**Frontend (3 apps):**
Next.js 15 App Router · React 19 · TypeScript strict · TailwindCSS · shadcn/ui · TanStack Query · Zustand

**Comunicación:**
tRPC (interno) · gRPC (cuando aplique, futuro) · REST (solo APIs públicas externas)

**Desktop (planificado, ADR-023):** Tauri v2 — cascarón fino sobre el dashboard desplegado (opción A)
**Observabilidad:** OpenTelemetry · Prometheus · Grafana (S4)
**Testing:** Jest · Supertest · Vitest · React Testing Library · Playwright (S4)
**Seguridad:** Firebase Auth + Session Cookies HttpOnly · RBAC · Helmet · Rate limiting

## Packages compartidos

| Package | Rol |
|---|---|
| `@real/auth-client` | Firebase wrapper + apiFetch para los 3 fronts |
| `@real/auth-server` | Guards, middleware, SessionService para los 2 backs |
| `@real/trpc` | Contratos tRPC — SassAppRouter + EcommerceAppRouter |
| `@real/ui` | 33 componentes shadcn — fuente única de UI |
| `@real/i18n` | Idioma de los paneles: cookie, diccionario común, provider y selector (ADR-028) |

---

## Integración con marketing-backend — contexto (2026-09-19)

**welver NO tiene código de marketing.** El microservicio vive en ecosistema-ms.

### Qué sí hace welver en este contexto

`realsass-sass-back` (pasarelapagos-backend de welver) **no existe** —
welver no tiene pasarela de pagos propia. El fire-forget de atribución
fue implementado en `pasarelapagos-backend` de **ecosistema-ms**.

### Resumen de qué vive donde

| Componente | Repo | Estado |
|-----------|------|--------|
| `marketing-backend` (servicio completo) | ecosistema-ms | ✅ |
| Fire-forget en `WebhookProcessor` | ecosistema-ms / pasarelapagos-backend | ✅ |
| `MarketingClient` en superadmin | superadmin | ✅ |
| Contrato documentado en welver | welver / .claude | ✅ (solo doc) |

### Por qué hay contratos de marketing en este .claude

El `tasks.md` tenía un pendiente de fire-forget para `pasarelapagos-backend`.
Ese pendiente fue documentado aquí por error de contexto — en realidad
corresponde a ecosistema-ms, no a welver. Ya está resuelto.

Ver `.claude/contracts/marketing-integration.md` para el contrato completo.

---

## Markets — expansión global (ADR-014)

### El norte: Shopify Markets

Shopify resolvió la expansión global como entidad de dominio, no como config de envío.
Adoptamos su filosofía: el dueño **declara** en qué países opera; el sistema **resuelve**.

### Principio de resolución

```
resolveMarket(organizationId, visitorCountryCode)
  → Market específico del país  (si existe y está activo)
  → Market default de la org    (fallback siempre disponible)
  → NUNCA null, NUNCA bloqueo
```

### Bounded contexts

| Repo | Rol |
|------|-----|
| `realsass-sass-back` | OWNER del modelo Market — CRUD, resolveMarket() |
| `realsass-ecommerce-back` | CONSUMER — llama resolveMarket() en checkout, guarda snapshot |
| `real-ecommerce-front` | DETECTOR — detecta país del visitante, envía X-Visitor-Country |
| `realsass-dashboard-front` | UI — gestión de Markets del dueño |

### Lo que NO modelamos (y por qué)

- Precios por Market → Stripe maneja multi-moneda
- Idioma por Market → Next.js i18n
- Impuestos por Market → Stripe Tax
- Restricciones de productos por país → over-engineering para escala actual

### Siguiente paso

Ver ADR-014 y los checklists MKT-01..09 en `.claude/modules/sass-back/markets.md`

<!-- ADR-016 -->
---

## SEO + idioma global (ADR-016)

### El norte

**Shopify Markets** (estructura) · **Apple** (no forzar) · **Airbnb / Booking** (el usuario manda) ·
**IKEA** (idioma ≠ país) · **Mercado Libre** (LatAm primero) · **Google Search Central** (las reglas)

*El sistema sugiere, el usuario decide, Google ve siempre la misma URL para el mismo contenido.*

### Reglas no negociables

```
URL        /{es|pt|en}/{slug}/...     idioma en la URL, país en el Market
Idioma     cookie > Accept-Language > país (no bots) > es
Redirect   solo /{slug}/... sin idioma (y el prefijo viejo /tienda/), 307. Una URL con idioma NUNCA redirige
Indexa     solo el idioma primario de la tienda (countryCode) hasta Fase 2
Errores    NOT_FOUND → 404 · cualquier otra falla → 5xx (Google conserva el índice)
```

Ver `architecture/10-seo-i18n-norte.md`, `decisions/ADR-016-seo-i18n-global.md` (estructura de URL enmendada por `ADR-022-urls-limpias.md`)
y `contracts/seo-i18n.md`. Esto completa el pendiente "Idioma por Market" de ADR-014.

<!-- ADR-018 -->
---

## UI/UX adaptable — desktop, tablet y mobile (ADR-024)

### El norte

**Shopify Polaris** (admin multi-tenant adaptable) · **Apple HIG** (lo táctil manda) · **Material 3** (clases de tamaño)

*Una sola interfaz que se adapta al dispositivo, no tres interfaces distintas.*

### Reglas no negociables

```
Tamaños    compact <600 · medium 600–839 · expanded ≥840; puntos de corte únicos en @real/ui
Navegación barra inferior (compact) · riel (medium) · barra lateral (expanded); mismas rutas
Táctil     objetivos ≥44 px; nada esencial depende de hover
Tokens     color/espaciado/radios/tipografía/motion solo desde @real/ui; sin valores hardcodeados
Calidad    contraste AA, foco visible, reduced-motion, sin user-scalable=no; Core Web Vitals en el storefront
Estados    toda vista con datos define cargando, vacío, error y sin permisos
Prioridad  storefront (celular) primero; dashboard y sass-front después; Tauri hereda el dashboard
```

Ver `architecture/12-ui-norte.md`, `decisions/ADR-024-ui-ux-adaptable.md` y `domain/ui.md` (sistema de diseño actual).
**Identidad de marca:** `domain/welver.html` es la referencia visual (tokens, tipografía, componentes). Los tokens y la piel viven en `packages/ui/src/styles/welver.css`, que importan los 4 fronts; no se definen colores propios por front.
**Modales:** un solo primitivo (`Dialog`, `AlertDialog`, `Sheet` de `@real/ui`). Cada modal declara su tipo con `preset` (`form`, `selection`, `detail`, `filters`, `longForm`, `search`; las alertas son `AlertDialog`) y la presentación cambia sola por clase de tamaño (hoja inferior en compact, centrado, panel lateral, pantalla completa, superior). Los fronts no definen anchos ni animaciones propias de modal; el hook `useSizeClass()` expone la clase.
**Navegación y botones:** la navegación de un panel es `AppShell` de `@real/ui` (barra inferior en compact, riel en medium, barra lateral colapsable en expanded, todo desde una sola lista de destinos); las páginas públicas usan la barra superior sticky de 56 px más una barra inferior de máx. 5 destinos en compact (`SiteHeader` + `SiteBrand` y `BottomTabBar`; `SectionIntro` para el encabezado de cada sección y `SiteFooter` para el pie, todos de `@real/ui`; `AuthPage` para accesos, `QuantityStepper` para cantidades y `Prose` para texto largo). **Ningún front arma UI propia: toda pantalla, botón, tarjeta, modal, barra o estado sale de `@real/ui`; si falta una pieza, se crea ahí primero.** Los puntos de corte `medium:` (600) y `expanded:` (840) ya existen como variantes de Tailwind. Todo botón es `Button` de `@real/ui` (también `asChild` sobre `Link`); no se arman botones a mano con clases.
**Estructura de página (`@real/ui`):** toda página es `PageContainer` + `PageHeader` (un solo `<h1>`, título serif) con `SectionHeader` para sus secciones; la navegación entre subpáginas es `SectionTabs`; una cifra es `StatCard`; los 4 estados de toda vista son `LoadingState` (cargando), `EmptyState` vacío, error con reintento y sin permisos; un módulo futuro es `ComingSoon`; el arranque de sesión es `Spinner`.
**Componentes de `@real/ui` a usar siempre:** `Field`/`FieldError` para campos con error, `NativeSelect` para listas cortas, `Table stack` + `data-label` en tablas (se vuelven tarjetas en compact), `Pagination`, `Breadcrumb` (3+ niveles), `Stepper` (flujos de 3–5 pasos), `EmptyState` (vacío, error, sin permisos), `Alert` (aviso en línea), `ActionMenu` (hoja en compact, popover desde medium), `SegmentedControl`, `Combobox` (más de ~7 opciones), `DateInput` (fecha nativa), `CommandPalette` + `useCommandShortcut` (Ctrl/⌘ K) y `LineChart`/`BarChart` (paleta por entidad, leyenda, tooltip con teclado y tabla gemela). No se arman a mano ni `<select>`, `<input>`, `<table>` ni bloques de error.
**Tema:** solo existen los dos modos de Welver, claro y oscuro, con selección Sistema (default) · Claro · Oscuro guardada en `localStorage["theme"]` y aplicada como clase `dark` (`ThemeProvider` y `ThemeToggle` de `@real/ui`, también en el sitio de ayuda). Ningún front fuerza un modo ni define colores propios: se usan los tokens (`bg-primary`, `text-success-ink`, `var(--chart-1)`…), nunca `text-gray-*`, `bg-blue-*` ni hex/rgba sueltos. La excepción son los colores de marca de terceros (logos de Google, WhatsApp, etc.) y los temas por organización del storefront.

---

## WhatsApp por organización — Embedded Signup (ADR-025) — implementado, sin probar con Meta

Cada organización conecta **su** WhatsApp desde el panel del dueño (`realsass-sass-front`, `/profile/config`); la plataforma usa una sola app de
Meta (Tech Provider) y el cliente paga su propia WABA. Plataforma en ecosistema-ms (`ADR-024-whatsapp-tech-provider-embedded-signup.md`).
Ruta: sass-front --tRPC--> sass-back (`whatsapp.*`, solo OWNER + step-up) --HTTP interno + `INTERNAL_API_KEY`--> chatia. Los secretos
(`accessToken`, `appSecret`) nunca llegan al front. **Falta crear la app de Meta** (`checklists/meta-whatsapp-app.md`).
Ver `decisions/ADR-025-whatsapp-embedded-signup-sass-front.md` y `contracts/whatsapp-channel.md`.

---

## Reportes de usuario (ADR-027) — implementado, migración sin aplicar

Cualquier miembro de una organización puede informar un problema desde el producto. **Norte:** Sentry User Feedback (reporte atado al
evento técnico) · Apple Feedback Assistant (consentimiento e ID de seguimiento) · Shopify (contexto de organización/módulo).
sass-back es dueño del modelo `FeedbackReport`; el front usa tRPC `feedback.*`; superadmin lee y actualiza por `/internal/feedback*` (patrón ADR-013).
Ver `architecture/13-reportes-norte.md`, `decisions/ADR-027-reportes-de-usuario.md` (incluye el plan por repo) y `contracts/user-feedback.md`.

---

## Región — América, Asia y Europa (ADR-026)

`domain/region/` es el **catálogo factual** del mundo en el que opera el producto: tres carpetas (`america`, `asia`, `europa`) con un `.md` por país (idioma, moneda,
pagos, logística, teléfono, legal, UI) y un estado de soporte (🟢 operativo · 🟡 candidato · ⚪ sin evaluar · 🔴 restringido). Hoy: AR base;
MX, CO y BR candidatos. **No reemplaza** a Market (ADR-014) ni a la i18n (ADR-016/017): los referencia. Un país nuevo es una ficha y una fila.
Ver `domain/region/README.md` y `decisions/ADR-026-region-catalogo-de-paises.md`.

---

## Dependencias — política única (ADR-018)

### El norte

**Google** (una versión, dueño, strict deps) · **Microsoft Rush** (cero phantom deps) ·
**OpenSSF / SLSA** (cadena de suministro)

*Toda dependencia es código ajeno que corre con nuestros permisos: entra con dueño,
con una sola versión y declarada donde se usa.*

### Reglas no negociables

```
Versión    solo catalog: o workspace:*  — nada hardcodeado
Declarar   todo import externo está en el package.json del workspace que lo usa
Libs       packages/* → frameworks en peerDependencies, nunca en dependencies
Nueva dep  checklist R4 del norte en el PR + dueño asignado
Lockfile   --frozen-lockfile en CI y en Railway
```

Ver `architecture/11-dependencias-norte.md` y `decisions/ADR-018-politica-dependencias.md`.

---

## Contratos tRPC — `dist` como única fuente para los fronts (ADR-019)

### El norte

**Contrato real o no hay contrato**: un procedure con `any` o un `dist` escrito a mano vacía el tipado
extremo a extremo que justifica usar tRPC.

### Reglas no negociables

```
Build      pnpm --filter @real/trpc build emite los .d.ts de cada back a packages/trpc/dist/contracts
Orden      prisma generate -> @real/trpc build -> backs -> fronts
Fronts     leen SOLO de @real/trpc (dist); tipos de dominio inferidos, nunca escritos a mano
Backs      importan solo @real/trpc/markets (hoja sin ciclo)
Procedures prohibido `any`: TRPCProcedureBuilder con contexto nombrado (evita TS2883)
Fronts     sin ignoreBuildErrors; sin alias @/ dentro de packages/*
Docker     cada Dockerfile de front tiene un stage `contracts` que genera packages/trpc/dist
CI/local   `pnpm contracts` (prisma generate de ambos backs + @real/trpc build) tras `pnpm install`
```

**Pendiente:** `docker build` real de los 3 fronts (solo se simuló en un directorio limpio).
Ver `decisions/ADR-019-contratos-trpc-desde-dist.md` y `modules/packages/trpc.md`.
