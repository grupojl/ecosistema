# ADR-023: Dashboard de escritorio con Tauri — opción A (cascarón sobre la URL desplegada)

**Fecha:** 2026-10-16
**Estado:** Aceptado — **F0 y F1 escritos, sin compilar** (la máquina de desarrollo no tenía Rust; la primera compilación real la hace el usuario)
**Alcance:** proyecto `realsass-dashboard-desktop` (fuera del workspace de pnpm) · `realsass-dashboard-front` (página puente + botón de login en modo escritorio). Solo el dashboard.
**Relacionado:** ADR-004 (cookies de sesión) · ADR-018 (política de dependencias) · ADR-022 (URLs limpias)

## Contexto

Se quiere empaquetar el dashboard de colaboradores como aplicación de escritorio. El stack es Tauri v2.

Condicionantes del dashboard actual:
- Next.js 16 con `output: 'standalone'`, `redirects()` y `headers()` (no es exportable como sitio estático sin perder cosas).
- Auth con Firebase + **cookie `__session` `HttpOnly`, `SameSite=Strict`** (ADR-004) hacia `realsass-sass-back`.
- Login con Google por `signInWithPopup`, que es frágil en un webview.
- Ya existe un SSO por **custom token**: `auth.createDashboardSso` (sass-back) + `/auth/sso?token=` (dashboard).

## Decisión

**Opción A: la ventana de Tauri carga el dashboard desplegado (URL remota).** La app de escritorio es un cascarón fino:
ventana, deep links, notificaciones nativas, auto-actualización firmada. **No hay lógica de negocio en Rust** y el dashboard
sigue siendo una sola base de código.

1. **Contenido:** `WebviewWindow` apuntando a `DASHBOARD_URL` (dev: `http://localhost:3022`; prod: la URL pública del panel).
2. **Cookies:** al cargar el dashboard real, la cookie es de primera parte (mismo sitio que la API con `COOKIE_DOMAIN`), así que
   `SameSite=Strict` sigue funcionando. Es la razón principal de elegir A sobre un bundle local (`tauri://localhost` quedaría
   como otro sitio y la cookie se bloquearía).
3. **Login:** NO se usa `signInWithPopup` dentro del webview. Flujo (RFC 8252, app nativa), **sin IPC desde el panel remoto**:
   1. Al arrancar, Rust abre un **servidor de loopback** en `127.0.0.1:{puerto-aleatorio}` y le inyecta al panel
      `window.__WELVER_DESKTOP__ = { loginPort, version }` (`initialization_script`). El panel solo conoce el puerto.
   2. En `/login`, si ese objeto existe, el panel muestra **"Continuar en el navegador"** (no el botón de Google). El botón navega a
      `http://127.0.0.1:{puerto}/start`.
   3. `/start` genera un `state` aleatorio de un solo uso y abre el **navegador del sistema** en `/desktop-login?port=…&state=…`
      (página puente nueva del panel).
   4. Esa página, con la sesión de siempre, pide `auth.createDashboardSso` y redirige a `http://127.0.0.1:{puerto}/callback?state=…&token=…`.
      Valida puerto y `state` antes de redirigir: solo se redirige a loopback.
   5. Rust verifica el `state` (un solo uso) y que el token tenga forma de JWT, y navega su webview a
      `${DASHBOARD_URL}/auth/sso?token=…` (la ruta que **ya existía**): `signInWithCustomToken` + cookie en el origen del dashboard.
   6. Loopback preferido sobre un esquema propio `welver://`: otra app podría registrar el mismo esquema y robar el token. El esquema
      queda solo para *abrir* la app desde fuera (F2).
   7. Defensas del servidor de loopback: solo GET, `Host` exacto `127.0.0.1:{puerto}` (anti DNS rebinding), un solo uso del `state`.
4. **Seguridad (modelo de permisos de Tauri v2):**
   - *Capabilities* mínimas; el contenido remoto **no** puede invocar comandos de archivos ni de shell.
   - Dominios permitidos: solo `DASHBOARD_URL` (y el de login). Navegación a otros dominios se abre en el navegador del sistema.
   - CSP estricta; sin `dangerousRemoteDomainIpcAccess`.
5. **Distribución:** `tauri-plugin-updater` con artefactos **firmados**; firma de código (Authenticode en Windows, notarización en macOS).
   Sin firma Windows muestra SmartScreen.
6. **Repo:** `realsass-dashboard-desktop/` con `src-tauri/` (Rust). **No es parte del workspace de pnpm** (no hay `package.json`): el CLI de
   Tauri corre con `cargo install tauri-cli`, y así no se toca el `pnpm-lock.yaml` ni el CI/Railway actuales. Las versiones las fija `Cargo.lock`.
   Los crates se auditan con `cargo audit`/`cargo deny` en CI (DT-DESK-4).
7. **Navegación:** la ventana solo puede ir al panel, a su pantalla local y al loopback del login; cualquier otro `http(s)` se abre en el
   navegador del sistema y cualquier otro esquema se bloquea (`decide_navigation`, con tests).
8. **Pantalla de conexión** local (`ui/index.html`, sin JavaScript para poder usar una CSP estricta): Rust espera a que el panel responda
   y navega; sin red reintenta cada 4 s.

## Fases

| Fase | Entrega | Estado |
|---|---|---|
| **F0** | Esqueleto: ventana que carga `DASHBOARD_URL`, capabilities mínimas, CSP, íconos, navegación restringida | ✍️ escrito, **sin compilar** |
| **F1** | Login por navegador del sistema + loopback + página puente (`/desktop-login`) + botón en `/login` | ✍️ escrito, **sin compilar** (la parte web sí pasa `tsc`) |
| **F2** | Instancia única, estado de ventana, **deep link `welver://open?path=…`**, **auto-actualización firmada** (feature `updater`, pregunta antes de instalar) | ✍️ escrito, **sin compilar** |
| **F3** | **Pipeline de release** (`.github/workflows/desktop-release.yml`: build en la nube, artefacto descargable, release con `latest.json`) ✍️ escrito · **firma de código** 🔲 (exige certificados comprados) | parcial |
| — | **Notificaciones nativas**: decisión de NO implementarlas todavía (el panel remoto no tiene IPC y el producto aún no emite notificaciones) | decidido |

## Decisiones de la segunda tanda (2026-10-16)

- **Deep link** `welver://open?path=/…`: solo abre rutas internas del panel (`deep_link_target`, con tests). Si la app se abre en frío con un enlace, la ruta queda pendiente y es la primera página al conectar.
- **Updater detrás de una feature de Cargo** (`--features updater`) y con su configuración en un overlay (`tauri.updater.conf.json`): el build por defecto funciona sin claves y la clave pública es un placeholder explícito. Siempre **pregunta** antes de instalar (en Windows el instalador cierra la app).
- **Release en la nube**: el workflow permite probar el instalador SIN Rust local (artefacto descargable) y publicar releases con tag `desktop-v*`.
- **Notificaciones**: no se implementan; ver README → "Notificaciones nativas".
- **Ícono**: generado desde `realsass-dashboard-front/public/logo.svg`. ⚠ es el logo de Apple: apto para pruebas internas, no para distribuir.

## Alternativas descartadas

- **B. Bundle estático** (`output: 'export'` dentro de la app): pierde `redirects()`/`headers()` y todo lo de servidor, y rompe la
  cookie `SameSite=Strict` por el origen distinto. Se reevalúa solo si hace falta funcionar sin conexión (hoy no).
- **Electron**: más pesado en memoria y disco; el único motivo para elegirlo sería un motor de render idéntico en todos los SO.
- **PWA instalable**: cubre "ícono y ventana propia", pero no deep links, updater propio ni notificaciones con la app cerrada.
- **`signInWithPopup` en el webview**: COOP/cross-origin y bloqueo de popups lo vuelven poco confiable.

## Consecuencias

**Se gana:** una sola base de código; el panel siempre está actualizado sin republicar la app (solo se actualiza el cascarón);
la auth y las cookies funcionan como en el navegador.

**Se sacrifica / límites:**
- Requiere conexión (es una web). Sin internet, la ventana muestra un aviso.
- La app depende de que el panel esté desplegado y accesible; una caída del panel es una caída de la app.
- Tiendas de aplicaciones (Mac App Store / Microsoft Store) pueden objetar los "envoltorios web"; para uso interno/B2B no aplica.
- Rust y WebView2 suman toolchain: en Windows hacen falta *MSVC Build Tools* y WebView2 (ya viene con Windows 11).

**Deuda consciente / riesgos:**
- El token del login viaja por loopback: vive pocos minutos y el puerto es aleatorio; ver endurecimiento (PKCE) en DT-DESK-3.
- **Nada de Rust se compiló todavía**: F0 es la primera verificación real. Los puntos con más riesgo de ajuste son las firmas de `WebviewWindow::{url, eval}` y de `initialization_script`/`on_navigation` entre versiones 2.x.
- El ícono es **provisorio** (generado por script); reemplazar con `cargo tauri icon`.
- La parte web (`lib/desktop.ts`, `/desktop-login`, `/login`) no tiene tests automáticos: el dashboard no tiene runner de pruebas (DT-DESK-6).

## Cómo se prueba (en una máquina con Rust)

```
rustup (stable) · MSVC Build Tools · WebView2
cargo install tauri-cli --version "^2" --locked
pnpm --filter realsass-dashboard-front dev:webpack     # el panel en :3022
cd realsass-dashboard-desktop && cargo tauri dev        # abre la ventana
cd src-tauri && cargo test                              # lógica pura: parseo, token, navegación
```
Checklist completo en `realsass-dashboard-desktop/README.md`.

## Referencias

- Patrón de la industria: Linear / Notion / Slack (web primero, cascarón nativo fino).
- Tauri en producción (código abierto, para estudiar `src-tauri`): Hoppscotch, Cap, Spacedrive. *(Verificar antes de citar.)*
- `auth.createDashboardSso` (`realsass-sass-back/src/trpc/routers/auth.router.ts`) · `realsass-dashboard-front/app/auth/sso/page.tsx`
