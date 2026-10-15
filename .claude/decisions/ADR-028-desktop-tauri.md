# ADR-028: App de escritorio del dashboard con Tauri

**Fecha:** 2026-10-15
**Estado:** Propuesto — se acepta (o se corrige) al cerrar el spike de la Fase 0 (`roadmap/desktop-tauri.md`)
**Alcance:** `realsass-dashboard-front` (+ un workspace nuevo `realsass-dashboard-desktop` y dos procedures en `sass-back`)
**Norte:** `architecture/14-desktop-tauri-norte.md` · **Complementa:** ADR-004, ADR-018, ADR-023, ADR-026, ADR-027

## Contexto

Se quiere que el panel de colaboradores (`realsass-dashboard-front`) funcione como aplicación de escritorio.

El dashboard no es una SPA estática, y eso es lo que condiciona todo:

| Característica actual | Choque con Tauri |
|---|---|
| `output: 'standalone'` y Server Components con `cookies()` + `HydrationBoundary` (`tienda/productos`, `tienda/pedidos`) | Tauri **no corre un servidor**: exige `output: 'export'` |
| Sesión = cookie `__session` HttpOnly creada por `POST /auth/session` (ADR-004), con `credentials: 'include'` | Con la UI empaquetada el origen es `tauri://localhost` / `http(s)://tauri.localhost`: la cookie hacia la API pasa a ser *cross-site* |
| Login con Google por `signInWithPopup` | Firebase exige origen `http(s)`; y Google no admite esquemas URI personalizados en escritorio |
| CORS con lista explícita (ADR-023, S2) | Habría que sumar los orígenes de Tauri |
| Sin CSP con nonces (ADR-026) | Con IPC habilitada para un origen remoto, un XSS hereda los permisos |

Referencia verificada: Hoppscotch Desktop ("construida sobre el cliente web", con Tauri). **No se encontró un caso público
de Next.js App Router + RSC + cookie HttpOnly bajo Tauri**, así que la decisión final depende de un spike con criterios medibles.

## Decisión

1. **Fase 1 — Modelo A (cáscara remota).** La app de escritorio es un workspace nuevo, `realsass-dashboard-desktop`, con
   Tauri v2. Su ventana carga el dominio del dashboard por `https`. El build del dashboard **no cambia**.
2. **Login por traspaso con el navegador del sistema** (no popup embebido): código de un solo uso (60 s) ligado a un
   desafío PKCE S256, deep link `realsass-dashboard://auth`, canje por un *custom token* de Firebase y cookie `__session`
   por el camino habitual. Dos procedures nuevos en `sass-back`:
   - `auth.createDesktopHandoff` — `authProcedure` (ya hay sesión web); guarda el código en Redis, ligado al desafío.
   - `auth.exchangeDesktopHandoff` — mutación **pública** (se agrega a `scripts/audit/public-mutations.allowlist` con su
     motivo, S10), rate limit estricto por IP, un solo uso, verifica `S256(verifier) == challenge`, audita, y devuelve el
     custom token reutilizando `AuthService.generateCustomTokenForUid` (el que ya emite `auth.createDashboardSso` para el
     SSO sass-front → dashboard; exige que el usuario tenga acceso activo). El deep link **nunca** lleva el token de
     Firebase, solo el código de un solo uso.
3. **Privilegios mínimos.** Sin capabilities por defecto; el dominio remoto recibe solo lo que una necesidad del negocio
   justifique, listado en `capabilities/*.json` y vigilado por la auditoría S11.
4. **Rust bajo la política de dependencias** (ADR-018): `Cargo.lock` versionado, `cargo audit` + `cargo deny` bloqueantes.
5. **Actualizaciones firmadas** (`requireSignedVersion`), binarios firmados y notarizados desde CI.
6. **Modelo B (UI empaquetada) queda como opción, no como plan.** Se adopta solo si el spike demuestra una necesidad
   (modo sin conexión, hardware) *y* los criterios de abajo se cumplen.

### Criterio para pasar de A a B (se mide en el spike)

Se evalúa B únicamente si se cumple **alguna** de estas necesidades de producto:
- la operación debe seguir sin red (leer pedidos/productos),
- se necesita acceso a hardware que requiere permisos que no conviene dar a un origen remoto (impresora, escáner, cajón),

**y** además B pasa estas pruebas (todas):
- `output: 'export'` compila con las 2 páginas con `cookies()` reescritas a cliente,
- la cookie `__session` hacia la API funciona en los tres webviews (WebView2, WKWebView, WebKitGTK) sin bajar la seguridad
  (`SameSite=None; Secure` + orígenes explícitos en `ALLOWED_ORIGINS`),
- no se necesita guardar tokens en `localStorage`.

Si no se cumple, se queda en A. Si se justifica pero la cookie *cross-site* falla en algún webview, la alternativa a evaluar
es que Rust guarde el credencial en el llavero del sistema y haga las llamadas (el JS nunca lo ve) — requeriría su propio ADR.

## Alternativas descartadas

- **UI empaquetada como primer paso (B).** Es el camino de Hoppscotch, pero su cliente es una SPA. Acá obliga a tocar el
  build, reescribir páginas, abrir CORS a los orígenes de Tauri y resolver cookies *cross-site* **antes** de entregar valor.
- **Servidor Node como *sidecar* (C).** Pierde la ventaja de tamaño de Tauri y agrega un runtime que parchear en cada
  instalación.
- **PWA instalable en lugar de Tauri.** Es la alternativa más barata y **debe descartarse con evidencia**: la Fase 0 exige
  nombrar al menos una capacidad nativa que la PWA no cubra (notificaciones confiables, bandeja del sistema, deep links,
  hardware). Si no existe, este ADR se rechaza y se hace la PWA.
- **Popup de Google dentro del webview.** No funciona en orígenes no `http(s)` y Google no lo admite en escritorio.
- **Guardar tokens en `localStorage` para evitar el problema de cookies.** Viola ADR-004 / ADR-023 (S3).
- **Electron.** Fuera de alcance: el pedido es Tauri. No se evaluó.

## Consecuencias

**Se gana:** app instalable con ventana propia, deep links, actualización controlada y base para capacidades nativas;
una sola base de código; las garantías del ecosistema (cookie HttpOnly, RLS, RSC) se conservan.

**Se sacrifica / queda como deuda consciente:**
- La app necesita conexión (igual que el dashboard, que no tiene modo sin conexión hoy).
- Un XSS del dominio remoto hereda las capabilities que se le den → **ADR-026 (CSP con nonces) pasa a ser prerrequisito**
  de cualquier capability remota que no sea trivial.
- Un toolchain nuevo (Rust) y un proceso de release nuevo (firmas, notarización, updater): cuentas de pago y secretos.
- Webviews distintos por sistema (WebView2, WKWebView, WebKitGTK): hay que verificar el baseline de Tailwind v4 y los
  componentes Radix en cada uno.
- `public-mutations.allowlist` suma `auth.exchangeDesktopHandoff` (justificado).

**No verificado en esta investigación (se verifica en la Fase 0):** comportamiento de cookies *cross-site* en WKWebView;
si Google bloquea el flujo OAuth dentro de un webview embebido (política conocida, no comprobada acá); el
comportamiento de `on_navigation`/`on_new_window` en la versión fijada; WebDriver de Tauri para e2e.

## Referencias

- `architecture/14-desktop-tauri-norte.md` (norte, reglas R1–R12, hechos con fuentes)
- `roadmap/desktop-tauri.md` (fases, tareas y criterios de salida)
- Código existente que se reutiliza: `realsass-dashboard-front/app/auth/sso/page.tsx` (canje de custom token),
  `realsass-sass-back/src/auth/auth.service.ts` (`generateCustomTokenForUid`), `auth.router.ts` (`createDashboardSso`),
  `packages/auth-client/src/react/auth-provider.tsx` (`POST /auth/session`)
- Deuda detectada (fuera del flujo de escritorio, ya existente): `/auth/sso` recibe el custom token en la **query string**
  (`?token=`), que queda en historial y logs. El flujo de escritorio no lo repite.
- Skill: `skills/desktop-tauri/SKILL.md`
