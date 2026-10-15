# 14 — Escritorio con Tauri: el norte para `realsass-dashboard-front`

> **Contrato (norte).** Define hacia dónde va la app de escritorio y las reglas que no se negocian. El *estado* y las
> tareas están en `roadmap/desktop-tauri.md` (dinámico). La decisión técnica está en `decisions/ADR-028-desktop-tauri.md`
> (**Propuesto**: se acepta cuando termine el spike de la Fase 0). Relacionado: ADR-004 (sesión por cookie), ADR-018
> (dependencias), ADR-023 (seguridad), ADR-026 (CSP), ADR-027 (RLS).

## El norte

**Un solo producto, dos formas de instalarlo.** El escritorio es una *distribución nativa* del dashboard web, no un
segundo producto. Mismo código, mismo contrato tRPC, misma sesión, mismas reglas de seguridad; lo único propio del
escritorio es una cáscara nativa mínima y de privilegios mínimos.

> *Lo que corre en el webview no es de confianza; lo que corre en Rust sí. Entre los dos hay una puerta con lista de
> permisos explícita.* (modelo de seguridad de Tauri)

Tres consecuencias que guían todo lo demás:
1. **Una sola base de código de UI.** Nada de `if (desktop)` esparcido: lo nativo vive detrás de un adaptador y la app
   web sigue funcionando en un navegador sin cambios.
2. **Privilegios mínimos por defecto.** Sin capacidades, el contenido remoto no tiene acceso al sistema. Cada permiso
   nuevo es una decisión documentada.
3. **Las invariantes del ecosistema no se relajan por ser escritorio.** Cookie HttpOnly (ADR-004), organización validada
   en el servidor, RLS (ADR-027), `Zod` como única validación, lista de orígenes CORS explícita (ADR-023).

## Referencia: qué se verificó y qué no

| Referencia | Qué se verificó | Qué NO se pudo verificar |
|---|---|---|
| **Hoppscotch Desktop** ([docs](https://docs.hoppscotch.io/documentation/clients/desktop)) | Su app de escritorio está "construida sobre el cliente web de Hoppscotch" y "potenciada por Tauri". Instaladores por sistema: `.dmg` (Apple Silicon e Intel), `.msi` y portable en Windows, `.deb` y `.AppImage` en Linux. El versionado de escritorio acorta el año (`26.x.x`) porque **un MSI no admite una versión mayor > 255**. | La docs no hacen afirmaciones de rendimiento ni de tamaño frente a Electron; no se citan. Tampoco se verificó cómo reparten el código entre web y escritorio. |
| **Modelo de seguridad de Tauri** ([docs](https://v2.tauri.app/security/)) | Núcleo Rust de confianza total; webview restringido a lo que expone la capa IPC; permisos por *capabilities*; CSP y patrón de aislamiento como controles. | — |
| Spacedrive, 1Password, Cody | — | Aparecen en un directorio de baja calidad como usuarios de Tauri; **no están verificados y no se usan como referencia**. |

> **Límite honesto de la referencia.** No se encontró un caso público de una app **Next.js App Router con Server Components
> y sesión por cookie HttpOnly** empaquetada con Tauri. Hoppscotch es la referencia verificada de "cliente web → escritorio con
> Tauri", pero su cliente es una SPA. Por eso la decisión de arquitectura se confirma con un **spike** (Fase 0) y no se da
> por cerrada en un documento.

## Hechos de Tauri que condicionan el diseño (verificados)

| Hecho | Fuente | Impacto en nuestro dashboard |
|---|---|---|
| Tauri **no corre un servidor**: Next.js debe exportarse estático (`output: 'export'`, `images.unoptimized`, `frontendDist: ../out`). | [Next.js + Tauri](https://v2.tauri.app/start/frontend/nextjs/) | El dashboard usa `output: 'standalone'` y **Server Components con `cookies()`** (`tienda/productos`, `tienda/pedidos`): no se pueden empaquetar tal cual. |
| Una ventana puede cargar una **URL remota** `http(s)`. | [WindowConfig](https://v2.tauri.app/reference/config/) | Permite el modelo "cáscara remota": cero cambios al build de Next. |
| El contenido remoto **no tiene acceso a la IPC** salvo que una *capability* lo habilite con `remote.urls` (URLPattern). Los permisos se mezclan si una ventana está en varias capabilities. | [Capabilities](https://v2.tauri.app/security/capabilities/) | Cualquier permiso que se le dé al dominio del dashboard lo hereda un XSS de ese dominio (hoy **no hay CSP con nonces**, ADR-026). |
| En Windows/Android el origen es `http://<scheme>.localhost` (o `https://` con `useHttpsScheme`); en macOS/Linux, `<scheme>://localhost`. Cambiar eso entre versiones **cambia dónde viven cookies, IndexedDB y localStorage**. | [WindowConfig](https://v2.tauri.app/reference/config/) | Si se empaqueta la UI, el origen no es `https` en macOS/Linux; fijar `useHttpsScheme` desde el día 1. |
| **Firebase Auth**: `signInWithPopup`/`signInWithRedirect` exigen `location.protocol` `http` o `https`. | [Firebase JS](https://firebase.google.com/docs/reference/js/auth) | `loginWithGoogle` (popup) no funciona en un origen `tauri://`. |
| **Google** no admite esquemas URI personalizados para apps de escritorio; recomienda el redirect de loopback `127.0.0.1` con PKCE. | [OAuth para apps nativas](https://developers.google.com/identity/protocols/oauth2/native-app) | El deep link no puede ser el `redirect_uri` de Google; tiene que ser un salto desde **nuestra** página web. |
| Deep links en escritorio: solo para apps **instaladas**; Windows/Linux entregan la URL como argumento (usar `single-instance`); en macOS no se registran en runtime; **hay que validar la URL** porque cualquiera puede inventarla. | [Deep linking](https://v2.tauri.app/plugin/deep-linking/) | El traspaso de login por deep link se prueba con la app instalada, no en dev. |
| El **updater exige firma** (no se puede desactivar); perder la clave privada impide publicar actualizaciones a los usuarios ya instalados; `requireSignedVersion` evita que la versión anunciada no coincida con lo firmado. | [Updater](https://v2.tauri.app/plugin/updater/) | La clave del updater es un activo crítico con respaldo y custodia. |
| Windows: la firma no es obligatoria para ejecutar, pero sin ella SmartScreen advierte; desde 2024 EV y OV construyen reputación igual. macOS: **firma + notarización** requieren cuenta de Apple Developer de pago. | [Windows](https://v2.tauri.app/distribute/sign/windows/) · [macOS](https://v2.tauri.app/distribute/sign/macos/) | Costos y cuentas a resolver antes de distribuir. |
| `on_navigation` cancela navegaciones y `on_new_window` atiende `target="_blank"`; hay que probarlo en la versión usada. | [WebviewBuilder](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html) | La cáscara debe impedir que el webview navegue fuera del dominio del dashboard. |
| En Linux y Android, Tauri **no distingue** una petición de un `<iframe>` de la de la ventana. | [Capabilities](https://v2.tauri.app/security/capabilities/) | No permitir iframes de terceros en el dashboard si hay permisos remotos. |

Versiones vigentes al 2026-10-15 ([releases](https://v2.tauri.app/release/)): `tauri` 2.12.3, `@tauri-apps/cli` 2.12.2,
updater 2.13.3, deep-link 2.6.1, single-instance 2.5.3, window-state 2.5.0, notification 2.6.0, opener 2.7.1.
Se instalan por `catalog:` respetando `minimumReleaseAge` (ADR-018).

## Cómo encaja en el ecosistema

```
 ┌───────────── realsass-dashboard-desktop (NUEVO workspace) ─────────────┐
 │  src-tauri/ (Rust, de confianza)                                       │
 │    · ventana · menú · tray · single-instance · window-state            │
 │    · deep link  realsass-dashboard://   (validado)                      │
 │    · on_navigation → solo el dominio del dashboard; lo demás: navegador │
 │    · updater (firmado)                                                  │
 │  capabilities/  → mínimas; remote.urls SOLO el dominio del dashboard    │
 └──────────────────────────────┬─────────────────────────────────────────┘
                                │ carga (https)
                                ▼
 realsass-dashboard-front  (SIN CAMBIOS de build: sigue 'standalone' en Railway)
   · RSC + HydrationBoundary · tRPC · cookie __session HttpOnly (first-party)
   · lib/desktop/  → adaptador: detecta el escritorio y habla con el shell
                                │ tRPC (mismas reglas, mismo CORS)
                                ▼
                    sass-back / ecommerce-back  (RLS, rate limit, guards)
```

**Login (traspaso por navegador del sistema):** el escritorio abre el navegador → el usuario inicia sesión en la web
(donde el popup de Firebase funciona) → la web genera un **código de un solo uso** ligado a un desafío PKCE y redirige
a `realsass-dashboard://auth?code=…&state=…` → el escritorio valida y navega el webview a `/auth/desktop` → esa página
canjea el código por un *custom token* de Firebase (se reutiliza `AuthService.generateCustomTokenForUid`, el mismo que
emite `auth.createDashboardSso` para el SSO entre sass-front y el dashboard) y el `AuthProvider`
crea la cookie `__session` por el camino de siempre (`POST /auth/session`, la excepción REST de ADR-004). **No hay
tokens en `localStorage`, ni credenciales en la URL, ni una excepción REST nueva.**

## Los tres modelos considerados (resumen; el detalle está en ADR-028)

| Modelo | Qué es | Veredicto |
|---|---|---|
| **A. Cáscara remota** | Tauri abre `https://dashboard.…`; sin empaquetar la UI | **Fase 1.** Conserva RSC, cookie HttpOnly y el despliegue actual. Requiere red (el dashboard ya la requiere para toda acción). |
| **B. UI empaquetada** | `output: 'export'` dentro del instalador (el camino de Hoppscotch) | **Solo si el spike lo justifica** (modo sin conexión, hardware). Obliga a sacar `cookies()` de 2 páginas, resolver cookies *cross-site* y sumar los orígenes de Tauri a `ALLOWED_ORIGINS`. |
| **C. Servidor Node como *sidecar*** | Empaquetar Next `standalone` + Node | **Descartado.** Pierde la ventaja de tamaño de Tauri y suma un runtime que parchear. |

## Reglas no negociables

```
R1  El escritorio no tiene lógica de negocio: toda regla vive en los backs. Rust solo hace de cáscara.
R2  Sin capabilities => sin acceso. Toda capability nueva exige: motivo, alcance mínimo y un test que la verifique.
R3  Prohibido en capabilities del dominio remoto: fs, shell, http amplio, process, os-info y cualquier permiso de escritura.
R4  El webview solo navega al dominio del dashboard; todo lo demás se abre en el navegador del sistema (opener).
R5  El login nunca usa un webview embebido para Google: navegador del sistema + traspaso con código de un solo uso + PKCE.
R6  La sesión es la cookie __session HttpOnly de siempre. Sin tokens en localStorage ni en la URL (salvo el código de
    un solo uso, de 60 s, en el fragmento).
R7  Toda URL que entra por deep link se valida (esquema, host, forma, `state`) antes de usarse.
R8  El updater siempre con firma, `requireSignedVersion` activo y la clave privada fuera del repo y con respaldo.
R9  Rust entra bajo la misma política que npm (ADR-018): `Cargo.lock` versionado, `cargo audit` y `cargo deny` bloqueantes
    en CI, versiones fijadas y cada crate nuevo con dueño.
R10 La web sigue funcionando sin el shell: `lib/desktop/` detecta el entorno y degrada; nada importa `@tauri-apps/*`
    fuera de ese adaptador.
R11 El origen del webview y `useHttpsScheme` se fijan antes del primer release y no cambian (mover el origen pierde
    cookies, IndexedDB y localStorage de los usuarios).
R12 Una regla que no falla en CI no es una regla: cada una de estas tiene una auditoría (S11 en `seguridad.sh`) o un test.
```

## Seguridad por capa del escritorio (criterio de 10/10)

| Capa | Criterio de 10/10 | Cómo se verifica |
|---|---|---|
| **D0 Web (dashboard)** | CSP con nonces; sin XSS posible que herede permisos | ADR-026 (dependencia directa: con IPC remoto, un XSS pesa más) |
| **D1 Navegación** | Solo el dominio del dashboard; `target="_blank"` y enlaces externos al navegador | Test del validador de URLs (Rust) + prueba manual por OS |
| **D2 Capabilities** | Vacías por defecto; remote solo el dominio del dashboard con permisos listados | Auditoría S11 sobre `capabilities/*.json` |
| **D3 Deep link / login** | Código de un solo uso, 60 s, PKCE S256, `state`, rate limit estricto, auditoría | Tests de integración del backend + prueba de repetición del código |
| **D4 Actualizaciones** | Firmadas, `requireSignedVersion`, clave respaldada; una actualización con firma inválida se rechaza | Prueba de actualización n → n+1 y de firma alterada |
| **D5 Distribución** | Binarios firmados y notarizados desde CI; checksums publicados | `tauri-action` en CI + verificación de firma en el job |
| **D6 Cadena de suministro** | `cargo audit`/`cargo deny` en 0; `Cargo.lock` versionado | Job de CI |

## Estructura propuesta

```
realsass-dashboard-desktop/          # workspace nuevo (no se toca el Dockerfile ni el deploy del front)
  package.json                       # scripts tauri; @tauri-apps/cli por catalog:
  src-tauri/
    Cargo.toml · Cargo.lock · tauri.conf.json
    capabilities/                    # JSON, revisado por S11
    src/ (lib.rs, main.rs, navigation.rs, deep_link.rs)
  ui-offline/index.html              # pantalla local "sin conexión" (único contenido empaquetado en el modelo A)
realsass-dashboard-front/
  lib/desktop/                       # adaptador (detección + puente); único lugar que habla con @tauri-apps/*
  app/auth/desktop/page.tsx          # canje del código (cliente)
```

Puertos: el escritorio no abre ninguno; en desarrollo carga `http://localhost:3022` (el dashboard).

## Qué NO se hace

- No se agrega lógica de negocio en Rust ni se duplica el contrato tRPC.
- No se cambia el build de producción del dashboard (`standalone`) por el del escritorio.
- No se usan `localStorage` ni credenciales en la URL para la sesión.
- No se publica sin firma ni sin pasar el CI.
- No se toma ninguna capacidad nativa "por si acaso": cada una nace de una necesidad del negocio (Fase 0).

## Fuentes

- Tauri: [Next.js](https://v2.tauri.app/start/frontend/nextjs/) · [Security](https://v2.tauri.app/security/) · [Capabilities](https://v2.tauri.app/security/capabilities/) · [Configuración](https://v2.tauri.app/reference/config/) · [Deep linking](https://v2.tauri.app/plugin/deep-linking/) · [Updater](https://v2.tauri.app/plugin/updater/) · [Firma Windows](https://v2.tauri.app/distribute/sign/windows/) · [Firma macOS](https://v2.tauri.app/distribute/sign/macos/) · [Releases](https://v2.tauri.app/release/)
- [Hoppscotch Desktop](https://docs.hoppscotch.io/documentation/clients/desktop)
- [Google OAuth para apps nativas](https://developers.google.com/identity/protocols/oauth2/native-app) · [Firebase Auth JS](https://firebase.google.com/docs/reference/js/auth)
