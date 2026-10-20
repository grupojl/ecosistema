# realsass-dashboard-desktop

Cascarón de escritorio (**Tauri v2**) del dashboard de Welver. **Opción A** del [ADR-023](../.claude/decisions/ADR-023-dashboard-desktop-tauri.md):
la ventana carga el dashboard **desplegado** (`DASHBOARD_URL`); no hay lógica de negocio en Rust.

> ⚠ **Escrito sin poder compilarlo** (la máquina de desarrollo no tenía Rust). La primera compilación real es la fase F0.
> Si algo no compila, pasá el mensaje de `cargo`: lo más probable es un ajuste de versión de Tauri o de un plugin.

## Qué hace

- Muestra una pantalla de conexión y navega al panel apenas responde (reintenta cada 4 s si no hay red).
- Solo deja navegar al panel; cualquier otro `http(s)` se abre en el navegador del sistema.
- **Login (PKCE + código de un solo uso, DT-DESK-3):** el popup de Google no es confiable en un webview, así que el botón "Continuar en el
  navegador" abre el navegador del sistema en `/desktop-login`. La app genera un `verifier` secreto y manda solo su `challenge`
  (SHA-256); la página, ya con sesión, pide al back un **código** de un solo uso (60 s) y vuelve a `http://127.0.0.1:{puerto}/callback`.
  La app verifica el `state` y la vigencia (5 min) y navega a `/auth/desktop?code=…&verifier=…`, donde el panel canjea el código por
  el token. **Por el loopback nunca viaja un token**: un código robado no sirve sin el verifier.
- Una sola instancia, y recuerda tamaño/posición de la ventana.
- **Deep link** `welver://open?path=/tienda/pedidos` abre la app y navega a esa ruta del panel (solo rutas internas; nunca sale del panel).
- **Auto-actualización firmada** (opcional, `--features updater`): pregunta antes de instalar.
- El panel remoto **no tiene acceso a IPC** (ver `src-tauri/capabilities/default.json`).

## Requisitos (una sola vez)

| Sistema | Qué instalar |
|---|---|
| Windows | [Rust](https://rustup.rs) (toolchain `stable-x86_64-pc-windows-msvc`), **Visual Studio Build Tools** con "Desarrollo para el escritorio con C++", y **WebView2** (ya viene con Windows 11) |
| macOS | Rust y `xcode-select --install` |
| Linux | Rust y las dependencias de WebKitGTK ([guía](https://v2.tauri.app/start/prerequisites/)) |

```
cargo install tauri-cli --version "^2" --locked
```

No hace falta Node ni pnpm para esto: el CLI de Tauri corre desde `cargo` (este proyecto **no** es parte del workspace de pnpm).

## Probar SIN instalar Rust: compilar en la nube

El workflow `.github/workflows/desktop-release.yml` compila el instalador de Windows en GitHub Actions y lo deja como artefacto:

1. GitHub → **Actions** → "Desktop — build y release (Tauri)" → **Run workflow** → pegá la `DASHBOARD_URL` de un panel accesible desde internet.
2. Al terminar, descargá el artefacto `welver-dashboard-desktop-windows` (`.exe`/`.msi`) y probalo en cualquier PC con Windows. **No hace falta Rust.**
3. El workflow corre antes `cargo test`: si la lógica pura falla, lo ves en el log.

Limitación: la app carga la URL del panel, así que ese panel tiene que ser alcanzable desde la PC de prueba (un `localhost` de otra máquina no sirve).
Con un tag `desktop-v0.1.0` además se crea un release en borrador con los instaladores.

## Probar (desarrollo)

1. Levantá el backend y el panel (en el repo principal):
   ```
   pnpm dev                                    # backs + fronts, o bien:
   pnpm --filter realsass-dashboard-front dev:webpack
   ```
2. En esta carpeta:
   ```
   cargo tauri dev
   ```
   Abre la ventana y carga `http://localhost:3022`. Para otro entorno:
   ```
   DASHBOARD_URL=https://panel.tu-dominio.com cargo tauri dev        # bash
   $env:DASHBOARD_URL="https://panel.tu-dominio.com"; cargo tauri dev  # PowerShell
   ```
3. Tests de la lógica pura (parseo, PKCE, validación del código, política de navegación):
   ```
   cd src-tauri && cargo test
   ```

## Calidad en CI

`.github/workflows/ci-desktop.yml` (en cada PR que toque esta carpeta): `cargo test`, `cargo clippy -D warnings`, `cargo audit` y `cargo deny check`
(política en `src-tauri/deny.toml`, ADR-018) y los tests de la parte web del login (`pnpm --filter realsass-dashboard-front test`).
`desktop-release.yml` repite la auditoría antes de publicar. ⚠ Ninguno de estos workflows se ejecutó todavía.

## Checklist de prueba (F0 + F1)

- [ ] `cargo tauri dev` compila y abre la ventana.
- [ ] La pantalla "Conectando con el panel…" aparece y el panel carga solo.
- [ ] Con el panel apagado, muestra "No se puede conectar… Reintentando" y se conecta cuando lo levantás.
- [ ] Sin sesión, el panel redirige a `/login` y se ve **"Continuar en el navegador"** (no el botón de Google).
- [ ] Ese botón abre el navegador del sistema; ahí iniciás sesión; la pestaña dice "Listo… ya podés cerrar esta pestaña".
- [ ] La ventana de la app entra sola al panel, ya autenticada (pasa por `/auth/desktop`; la URL no queda con el código ni el verifier).
- [ ] Repetir el mismo enlace de callback una segunda vez NO inicia sesión (el `state` y el código son de un solo uso).
- [ ] Dejar pasar más de 5 minutos entre abrir el navegador y completar el login: la app rechaza el regreso.
- [ ] Abrir un enlace externo desde el panel lo abre en el navegador, no dentro de la app.
- [ ] Abrir la app por segunda vez enfoca la ventana existente.
- [ ] Cerrar y abrir la app recuerda tamaño y posición.
- [ ] En un navegador común, `/login` sigue mostrando "Continuar con Google" (no se rompió el login web).
- [ ] Deep link: con la app cerrada, ejecutar `start welver://open?path=/tienda/pedidos` (Windows) abre la app y termina en esa ruta; con la app abierta, solo navega.
- [ ] Un enlace malicioso (`welver://open?path=//evil.com`) NO navega a ningún lado.

## Deep links

Esquema `welver://`, registrado por el instalador (en `cargo tauri dev` lo registra la propia app en Windows/Linux).
Formato: `welver://open?path=/ruta/del/panel` (sin `path` abre la raíz). Pensado para emails, notificaciones y atajos. Rechaza cualquier ruta que no sea interna.

## Auto-actualización (opcional)

No está en el build por defecto porque necesita claves y un endpoint:

1. Generar el par de claves (una sola vez): `cargo tauri signer generate -w ~/.tauri/welver.key`. **La clave privada no se commitea ni se pierde**: sin ella no se pueden publicar actualizaciones.
2. Pegar la clave **pública** en `src-tauri/tauri.updater.conf.json` (campo `pubkey`; hoy dice REEMPLAZAR…). El endpoint ya apunta a los releases de `grupojl/ecosistema`.
3. En GitHub → Settings → Secrets: `TAURI_SIGNING_PRIVATE_KEY` (y `..._PASSWORD` si la protegiste).
4. Publicar con un tag `desktop-vX.Y.Z`: el workflow compila con `--features updater`, firma y sube `latest.json`. La app pregunta "¿Actualizar ahora?" cada 6 h (primera a los 20 s).
5. Local: `cargo tauri build --features updater --config src-tauri/tauri.updater.conf.json` (con `TAURI_SIGNING_PRIVATE_KEY` en el entorno).

⚠ En Windows el instalador cierra la app: por eso **siempre pregunta antes** y nunca actualiza en silencio.

## Firma de código (necesita comprar certificados)

Sin firma, Windows muestra **SmartScreen** ("editor desconocido") y macOS bloquea la app. Eso NO se resuelve con código:

| Sistema | Qué hace falta |
|---|---|
| Windows | Certificado de firma de código (OV o EV) o *Azure Trusted Signing*; se configura en `bundle.windows` (`certificateThumbprint` o `signCommand`) |
| macOS | Apple Developer Program (US$ 99/año): certificado Developer ID + notarización (variables `APPLE_*` del workflow) |

La firma **del updater** (arriba) es otra cosa: protege las actualizaciones y es gratis.

## Notificaciones nativas — decisión: no se implementan todavía

El panel remoto no tiene IPC (a propósito) y hoy el producto **no genera notificaciones** (la capa de notificaciones del panel está pendiente). Construirlo ahora sería código sin uso.
Cuando el panel emita notificaciones: primero probar la API web `Notification` dentro del webview; si no alcanza, habilitar un único permiso de `tauri-plugin-notification` para el origen del panel en `capabilities` (`remote.urls`), no más.

## Build de producción

```
DASHBOARD_URL=https://panel.tu-dominio.com cargo tauri build
```
Genera el instalador en `src-tauri/target/release/bundle/`. Sin firma de código, Windows muestra SmartScreen (F3).

## Íconos

`src-tauri/icons/` se generó desde el logo del dashboard (`realsass-dashboard-front/public/logo.svg`) sobre un cuadrado oscuro: PNG, `.ico` y `.icns`.
⚠ **Ese logo es el logo de Apple.** Sirve para pruebas internas, pero **no lo distribuyas** públicamente: es una marca registrada ajena. Cuando tengas el logo propio, reemplazalo y regenerá todo con:
```
cargo tauri icon app-icon.png      # con tu PNG cuadrado de 1024×1024
```

## Runbook de release y rollback

**Publicar:** tag `desktop-vX.Y.Z` → `desktop-release.yml` (tests, auditoría, build, release en borrador). Revisar el borrador y publicarlo.

**Una versión salió rota.** El updater de Tauri solo sube de versión: no se "vuelve atrás", se avanza a una corregida. Pasos:
1. En sass-back cargar `DESKTOP_BLOCKED_VERSIONS=X.Y.Z` (la rota) y `DESKTOP_DOWNLOAD_URL`. Reiniciar el servicio.
2. Quien tenga esa versión ve, al abrir el panel, el aviso "Esta versión tiene un problema" con el enlace de descarga (`DesktopGuard`).
3. Corregir, publicar `desktop-vX.Y.(Z+1)` y, si hace falta forzar a todos, subir `DESKTOP_MIN_VERSION`.
4. Quitar la versión de la lista cuando ya no queden instalaciones (la métrica por versión está en los contadores `desktop:ping:*` de Redis).

**Versión mínima soportada:** `DESKTOP_MIN_VERSION=x.y.z`; por debajo, el panel pide actualizar. Sin la variable no se restringe a nadie.
⚠ La política la aplica el panel dentro de la app: una versión vieja que ya no abre el panel (por ejemplo, con la URL cambiada) no puede avisarse así.

**Telemetría:** solo con consentimiento (aviso al primer arranque, guardado en el equipo). Envía versión, sistema operativo y errores del panel; nunca datos de la persona ni del negocio. Código en `realsass-sass-back/src/desktop/` y `realsass-dashboard-front/components/desktop/`.

## Problemas conocidos / dónde mirar si falla

| Síntoma | Causa probable |
|---|---|
| `error: failed to select a version for tauri-plugin-…` | Versión de un plugin distinta de la de `tauri`; alinear los `2.x` en `Cargo.toml` |
| `no method named navigate/url/eval…` o diferencia de firma | Cambió una API menor entre 2.x: ajustar en `main.rs` (las llamadas están agrupadas en `location_replace`/`set_message`/`connect`) |
| `icons/icon.ico not found` | No se copiaron los íconos; correr `cargo tauri icon app-icon.png` |
| La ventana queda en "Conectando…" | `DASHBOARD_URL` mal escrita o el panel no corre en ese puerto |
| El login por navegador no vuelve a la app | Mirar que el panel tenga la página `/desktop-login` y que el navegador no bloquee `http://127.0.0.1` |

## Estructura

```
realsass-dashboard-desktop/
├─ app-icon.png               ícono fuente (provisorio)
├─ ui/index.html              pantalla local de conexión (sin JavaScript; CSP estricta)
└─ src-tauri/
   ├─ Cargo.toml · build.rs · tauri.conf.json · tauri.updater.conf.json (solo builds con updater)
   ├─ capabilities/default.json   permisos mínimos (solo contenido local)
   ├─ icons/
   └─ src/main.rs             ventana, loopback del login, política de navegación, tests
```
