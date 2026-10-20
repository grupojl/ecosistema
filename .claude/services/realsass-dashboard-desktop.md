# realsass-dashboard-desktop (F0 + F1 escritos, Rust SIN COMPILAR — ADR-023)

> **Estado:** el código existe en `realsass-dashboard-desktop/` pero **nunca se compiló** (no había Rust en la máquina de desarrollo). Se prueba con el checklist de `realsass-dashboard-desktop/README.md`.

## Rol

Cascarón de escritorio (Tauri v2) del dashboard de colaboradores. **Opción A**: la ventana carga el dashboard desplegado
(`DASHBOARD_URL`); no hay lógica de negocio en Rust ni se duplica el front.

## Le corresponde

- La ventana, su estado (tamaño/posición) e instancia única.
- Abrir el navegador del sistema para el login y recibir por loopback `127.0.0.1` (puerto aleatorio) un **código de un solo uso** — nunca un token — con PKCE (el `verifier` no sale de la app) — ✍️ escrito; la parte de back y web tiene tests, el Rust no se compiló.
- Restringir la navegación: solo el panel, la pantalla local y el loopback; lo demás al navegador del sistema — ✍️ escrito, con tests.
- Pantalla de conexión con reintentos — ✍️ escrito.
- Instancia única y estado de ventana — ✍️ escrito.
- Deep link `welver://open?path=/…` (solo rutas internas) — ✍️ escrito, con tests.
- Auto-actualización firmada (`--features updater`, pregunta antes de instalar) — ✍️ escrito; necesita generar claves y pegar la pública en `tauri.updater.conf.json`.
- Build/release en GitHub Actions (`desktop-release.yml`) — ✍️ escrito; sirve para probar sin Rust local.
- Política de versiones (mínima y bloqueadas) y telemetría con consentimiento — los aplica el panel (`DesktopGuard`) contra `desktop.policy` / `desktop.telemetry` de sass-back; el Rust no interviene.
- Notificaciones nativas — decidido **no** implementar todavía (ver ADR-023).
- Firma de código — 🔲 requiere certificados comprados.

## No le corresponde

- Autenticación propia: el login es el de Firebase del panel; la app solo transporta un código de un solo uso y su verifier a `/auth/desktop`, donde el panel lo canjea.
- Acceso del contenido remoto al sistema de archivos o al shell (las *capabilities* lo prohíben).
- Servir el front: el contenido es el dashboard desplegado.

## Conecta con

| Servicio | Cómo |
|---|---|
| `realsass-dashboard-front` | carga su URL; usa `/auth/desktop?code=&verifier=` (canje), `/desktop-login` (página puente en el navegador) y `lib/desktop.ts` (con tests, `pnpm test`); el botón "Continuar en el navegador" de `/login` aparece solo si la app inyectó `window.__WELVER_DESKTOP__` (`lib/desktop.ts`) |
| `realsass-sass-back` | `auth.issueDesktopLoginCode` (con sesión) y `auth.redeemDesktopLogin` (público: código + verifier → custom token). Código en Redis con GETDEL, 60 s |
| Navegador del sistema | login con Google fuera del webview |

## Variables

| Variable | Dev | Prod |
|---|---|---|
| `DASHBOARD_URL` | `http://localhost:3022` | URL pública del panel |

## Fases

F0 esqueleto · F1 login por navegador del sistema · F2 updater y notificaciones · F3 firma y release. Ver ADR-023 y
`roadmap/deuda-tecnica.md` (DT-DESK-*).

## Requisitos para compilar

Rust estable, MSVC Build Tools (Windows), WebView2, `cargo install tauri-cli --version "^2" --locked`, y el panel corriendo (`pnpm --filter realsass-dashboard-front dev:webpack`). No usa pnpm: no es parte del workspace.

## Archivos

`src-tauri/{Cargo.toml,build.rs,tauri.conf.json,tauri.updater.conf.json,capabilities/default.json,icons/,src/main.rs}` · `.github/workflows/desktop-release.yml` · `.github/workflows/ci-desktop.yml` · `src-tauri/deny.toml` · `ui/index.html` · `README.md` · `app-icon.png`.
