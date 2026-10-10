# Mapa de flujos — vista completa del producto

> Índice visual de `flows/`. Cada bloque `[[ ]]` es un archivo a completar.
> Los nodos marcados `?` son decisiones de producto que todavía **nadie definió**:
> son las preguntas que hay que contestar antes de tocar código.
>
> Leyenda: `✅` existe en código · `🟡` existe a medias · `❓` decisión pendiente · `🔲` no existe

```mermaid
flowchart TD
    %% ───────────── 0. AUTH (domain/auth.md) ─────────────
    subgraph AUTH["0 · Auth · domain/auth.md"]
        A1["Visitante en landing<br/>sass-front /"]
        A2{"¿Logueado?<br/>Firebase onAuthStateChanged"}
        A3["Modal de login ✅<br/>Google · Apple · Facebook"]
        A4["auth.sync (tRPC) ✅<br/>upsert User + claims"]
        A5["POST /auth/session (REST, ADR-004) ✅<br/>cookie HttpOnly __session"]
        A6["auth.me (tRPC) 🟡<br/>perfil + org + colaboraciones"]
        A7["Expira cookie 14 días ❓<br/>¿re-login silencioso o modal?"]
        A8["Logout ✅<br/>DELETE /auth/session + signOut"]
        A1 --> A2
        A2 -- no --> A3 --> A4 --> A5 --> A6
        A2 -- sí --> A6
        A6 --> A7
        A6 --> A8
    end

    %% ───────────── 1. ONBOARDING (flows/saas-onboarding.md) ─────────────
    subgraph ONB["1 · Onboarding · flows/saas-onboarding.md"]
        B1{"¿Tiene organización?<br/>profile.organization"}
        B2["Elegir rol ❓<br/>OWNER · afiliado (useSelectRole)"]
        B3["Crear organización 🟡<br/>nombre · slug"]
        B4["Plan / trial ❓<br/>¿gratis? ¿tarjeta?"]
        B5["Wizard inicial ❓<br/>¿obligatorio? ¿qué pasos?"]
        B6["/profile 🟡<br/>org + colaboraciones + afiliado"]
        B7["Invitación /invite/token ✅<br/>entra como colaborador"]
        B1 -- no --> B2 --> B3 --> B4 --> B5 --> B6
        B1 -- sí --> B6
        B7 --> B6
    end

    %% ───────────── 2. TIENDA (flows/tenant-store.md) ─────────────
    subgraph TS["2 · Tienda · flows/tenant-store.md"]
        C1["SSO → dashboard-front 🟡<br/>/auth/sso (useDashboardSSO)"]
        C2["Tema ✅<br/>config-themes"]
        C3["Mercados ✅<br/>país · moneda · idioma (ADR-014)"]
        C4["Primer producto ✅<br/>catalog + inventory + quotas"]
        C5{"¿Publicar?<br/>storeStatus ❓<br/>¿paso explícito o automático?"}
        C6["Storefront LIVE<br/>/lang/tienda/slug"]
        C1 --> C2 & C3 & C4
        C2 & C3 & C4 --> C5 --> C6
    end

    %% ───────────── 3. COMPRA (flows/storefront-buy.md) ─────────────
    subgraph BUY["3 · Compra · flows/storefront-buy.md"]
        D1["Visitante llega 🟡<br/>resolveMarket + idioma"]
        D2["Navega · categoría · producto ✅"]
        D3["Carrito ✅<br/>customer.cart.* ❓ ¿persiste? ¿requiere login?"]
        D4{"Checkout ❓<br/>¿guest o cuenta?"}
        D5["Envío ❓<br/>correo · envia · welivery"]
        D6["Pago ❓<br/>¿pasa por ecommerce-back o directo a pasarela?"]
        D7["Orden creada ✅<br/>snapshot de Market"]
        D8["Confirmación ❓<br/>¿email? ¿quién lo envía?"]
        D9["/tracking 🔲"]
        D1 --> D2 --> D3 --> D4 --> D5 --> D6 --> D7 --> D8 --> D9
    end

    %% ───────────── 4. OPERACIÓN (flows/dashboard-ops.md) ─────────────
    subgraph OPS["4 · Operación diaria · flows/dashboard-ops.md"]
        E1["Pedidos 🟡<br/>filtrar · detalle · cambiar estado"]
        E2["Productos ✅<br/>crear · editar · stock"]
        E3["Webhooks ✅<br/>eventos hacia sistemas externos"]
        E4["Colaboradores ✅<br/>roles y permisos"]
        E5["Campañas · Chat IA · Pagos 🔲<br/>servicios externos"]
    end

    %% ───────────── 5. SUPERADMIN (flows/superadmin.md) ─────────────
    subgraph SA["5 · Superadmin · flows/superadmin.md"]
        F1["INTERNAL_API_KEY<br/>sin Firebase"]
        F2["Organizaciones ✅<br/>crear · pausar · reanudar"]
        F3["Mercados globales ✅"]
        F4["Debug de tenant 🔲<br/>logs · flags · quotas"]
        F1 --> F2 & F3 & F4
    end

    %% ───────────── CONEXIONES ENTRE BLOQUES ─────────────
    A6 --> B1
    B6 -- "abrir dashboard" --> C1
    C6 -. "visitantes" .-> D1
    C6 --> E1
    D7 -. "aparece en" .-> E1
    E2 -. "se refleja en" .-> D2
    E3 -. "dispara eventos de" .-> D7
    F2 -. "pausa → storefront 404" .-> C6
    A7 -. "401 → vuelve a" .-> A3
```

## Puntos donde el flujo hoy está roto o ambiguo

| # | Dónde | Problema | Dónde se decide |
|---|---|---|---|
| 1 | `/login`, `/auth/sso`, `/dashboard` en `saas-onboarding.md` | Los flujos describen rutas que **no existen** en sass-front: el login es un modal en el navbar, la pantalla post-login es `/profile` | `auth.md` + `saas-onboarding.md` |
| 2 | A7 | Qué pasa cuando expira `__session` (hoy: 401 silencioso, sin re-login) | `auth.md` |
| 3 | B2 | `isOwner` no existe en el contrato; "dueño" se deduce de `organization !== null` (DT-SF-01) | `saas-onboarding.md` |
| 4 | B4–B5 | Trial, tarjeta, wizard: no hay decisión de producto | `saas-onboarding.md` |
| 5 | C5 | No hay paso "publicar": ¿qué dispara `storeStatus = ACTIVE`? | `tenant-store.md` |
| 6 | D3–D6 | Guest vs cuenta, persistencia de carrito, camino del pago | `storefront-buy.md` |
| 7 | D8–D9 | Email de confirmación y tracking sin dueño | `storefront-buy.md` |
| 8 | E1 | El dashboard no puede cambiar estado de pedido (DT-DASH-01) | `dashboard-ops.md` |

## Orden sugerido para completar

1. `auth.md` (hoy vacío): todo lo demás depende de él.
2. `saas-onboarding.md`: corregir las rutas (punto 1) y definir B2–B5.
3. `tenant-store.md`: decidir el "publicar" (C5).
4. `storefront-buy.md`: es el que más decisiones abiertas tiene.
5. `dashboard-ops.md` y `superadmin.md`.
