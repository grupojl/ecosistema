# realsass-dashboard-desktop (F0 + F1 escritos, SIN COMPILAR — ADR-023)

> **Estado:** el código existe en `realsass-dashboard-desktop/` pero **nunca se compiló** (no había Rust en la máquina de desarrollo). Se prueba con el checklist de `realsass-dashboard-desktop/README.md`.

## Rol

Cascarón de escritorio (Tauri v2) del dashboard de colaboradores. **Opción A**: la ventana carga el dashboard desplegado
(`DASHBOARD_URL`); no hay lógica de negocio en Rust ni se duplica el front.

## Le corresponde

- La ventana, su estado (tamaño/posición) e instancia única.
- Abrir el navegador del sistema para el login y recibir el token por loopback `127.0.0.1` (puerto aleatorio) — ✍️ escrito.
- Restringir la navegación: solo el panel, la pantalla local y el loopback; lo demás al navegador del sistema — ✍️ escrito, con tests.
- Pantalla de conexión con reintentos — ✍️ escrito.
- Instancia única y estado de ventana — ✍️ escrito.
- Deep link `welver://open?path=/…` (solo rutas internas) — ✍️ escrito, con tests.
- Auto-actualización firmada (`--features updater`, pregunta antes de instalar) — ✍️ escrito; necesita generar claves y pegar la pública en `tauri.updater.conf.json`.
- Build/release en GitHub Actions (`desktop-release.yml`) — ✍️ escrito; sirve para probar sin Rust local.
- Notificaciones nativas — decidido **no** implementar todavía (ver ADR-023).
- Firma de código — 🔲 requiere certificados comprados.

## No le corresponde

- Autenticación propia: el login es el de Firebase del panel; la app solo transporta el custom token a `/auth/sso`.
- Acceso del contenido remoto al sistema de archivos o al shell (las *capabilities* lo prohíben).
- Servir el front: el contenido es el dashboard desplegado.

## Conecta con

| Servicio | Cómo |
|---|---|
| `realsass-dashboard-front` | carga su URL; usa `/auth/sso?token=` (ya existía) y la página nueva `/desktop-login`; el botón "Continuar en el navegador" de `/login` aparece solo si la app inyectó `window.__WELVER_DESKTOP__` (`lib/desktop.ts`) |
| `realsass-sass-back` | `auth.createDashboardSso` (custom token) vía la página puente |
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

`src-tauri/{Cargo.toml,build.rs,tauri.conf.json,tauri.updater.conf.json,capabilities/default.json,icons/,src/main.rs}` · `.github/workflows/desktop-release.yml` · `ui/index.html` · `README.md` · `app-icon.png`.
