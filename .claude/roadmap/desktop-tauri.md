# Roadmap — App de escritorio del dashboard (Tauri)

> **Documento dinámico.** Estado y tareas. El norte y las reglas (R1–R12) están en
> `architecture/14-desktop-tauri-norte.md`; la decisión, en `decisions/ADR-028-desktop-tauri.md` (**Propuesto**).
> Se tilda una casilla **solo con evidencia ejecutada** (test, auditoría, build o prueba en el sistema operativo).

| | |
|---|---|
| **Creado** | 2026-10-15 |
| **Estado** | ⏳ Sin empezar — falta cerrar la Fase 0 (decisiones y spike) |
| **Modelo** | A (cáscara remota) en Fase 1; B (UI empaquetada) solo si el spike lo justifica |
| **Workspace nuevo** | `realsass-dashboard-desktop/` |
| **Tamaños** | S = medio día · M = 1–2 días · L = 3–5 días (orientativos, para ordenar, no para comprometer fechas) |

## Qué necesito del dueño antes de empezar (bloqueantes)

Son decisiones y cuentas que Claude no puede tomar ni crear. Sin ellas, la Fase 0 no puede cerrar.

- [ ] **D0.1 — ¿Por qué escritorio y no una PWA?** Nombrar al menos una capacidad nativa que justifique Rust y el proceso de
  release. Candidatas para un panel de tienda: notificaciones confiables de pedidos nuevos, impresión de tickets/etiquetas,
  escáner de código de barras, cajón de dinero, atajos globales, bandeja del sistema, arranque con el sistema, modo sin
  conexión. **Si no hay ninguna, el ADR-028 se rechaza y se hace una PWA** (mucho más barata).
- [ ] **D0.2 — Sistemas operativos objetivo** (Windows / macOS / Linux) y mínimos de versión. Define el costo de firma y la
  matriz de pruebas.
- [ ] **D0.3 — Cuenta de Apple Developer** (de pago, anual) si se distribuye en macOS: sin ella no hay notarización y
  macOS muestra advertencias de seguridad.
- [ ] **D0.4 — Firma de Windows:** elegir entre certificado OV, Azure Key Vault o Azure Artifact Signing. Sin firma,
  SmartScreen advierte al descargar; desde 2024 EV y OV construyen reputación igual.
- [ ] **D0.5 — Identificador de la app** (reverse-DNS, p. ej. `com.<empresa>.realsass.dashboard`) y **nombre del esquema de
  deep link** (propuesto `realsass-dashboard`). **No se pueden cambiar después sin perder datos locales** (R11).
- [ ] **D0.6 — Dónde se publican los instaladores y el `latest.json` del updater** (propuesto: GitHub Releases).
- [ ] **D0.7 — Custodia de la clave privada del updater.** Si se pierde, **no se pueden publicar más actualizaciones a los
  usuarios ya instalados**. Decidir dónde se guarda (gestor de secretos) y quién tiene el respaldo.
- [ ] **D0.8 — Dominios** del dashboard por entorno (staging y producción): el shell los necesita fijos.

## Fase 0 — Decisiones y spike (desbloquea todo)

**Objetivo:** aceptar o rechazar el ADR-028 con evidencia. No se escribe código de producto.

- [ ] **S0.1 (M)** Spike A: proyecto Tauri descartable que carga el dashboard de **staging**. Medir en cada SO objetivo:
  tamaño del instalador, memoria en reposo, tiempo hasta la pantalla de login. Anotar los números en este archivo.
- [ ] **S0.2 (M)** Verificar el **baseline del webview** en cada SO: Tailwind v4, Radix (portales, diálogos), Sonner,
  tema oscuro por defecto, scroll, atajos. (WebView2 en Windows, WKWebView en macOS, WebKitGTK en Linux.)
- [ ] **S0.3 (S)** Verificar que **el popup de Google dentro del webview falla o se bloquea** (se espera; documentar el
  mensaje exacto). Confirma por qué el login va por el navegador del sistema.
- [ ] **S0.4 (M)** Prototipo del **traspaso de login**: navegador del sistema → página web → deep link → canje →
  cookie `__session`. Confirmar que la cookie queda *first-party* en el webview y que `GET /auth/session` la reconoce.
- [ ] **S0.5 (S)** Probar `on_navigation` y `on_new_window` en la versión fijada: enlaces externos, `target="_blank"`,
  redirects. (Hay reportes de comportamiento distinto entre versiones; se prueba, no se asume.)
- [ ] **S0.6 (M, opcional)** Spike B acotado: ¿compila `output: 'export'` con las 2 páginas con `cookies()` reescritas?
  ¿funciona la cookie hacia la API en WKWebView (ITP) y WebView2? **Solo si D0.1 pide modo sin conexión o hardware.**
- [ ] **S0.7 (S)** Elegir y probar el mecanismo de **e2e** (Tauri WebDriver u otro) con un caso trivial.
- [ ] **Salida de la fase:** ADR-028 pasa a **Aceptado** (o Rechazado → PWA), con la tabla de resultados del spike adjunta.

## Fase 1 — Cáscara (workspace `realsass-dashboard-desktop`)

**Objetivo:** una app que abre el dashboard, se puede instalar y no abre puertas innecesarias.

- [ ] **T1.1 (S)** Crear el workspace: `package.json` (scripts `tauri`, `dev`, `build`), `src-tauri/` (`Cargo.toml`, `tauri.conf.json`),
  agregarlo a `pnpm-workspace.yaml`. `@tauri-apps/cli` y plugins por `catalog:` (skill `nueva-dependencia`; pedir confirmación).
- [ ] **T1.2 (S)** `tauri.conf.json`: identificador (D0.5), `useHttpsScheme: true`, ventana principal con URL por entorno
  (dev `http://localhost:3022`, staging, producción), CSP de la página local, sin capabilities.
- [ ] **T1.3 (M)** `navigation.rs`: función pura que decide **permitir / abrir en el navegador / bloquear** una URL, con tests
  Rust (dominio exacto, subdominios no permitidos, `javascript:`, `file:`, `data:`, puertos, mayúsculas, `@` en la URL).
  Cablearla a `on_navigation` y `on_new_window`; lo externo va por `opener`.
- [ ] **T1.4 (S)** `ui-offline/index.html`: pantalla local "sin conexión" con reintento (único contenido empaquetado).
- [ ] **T1.5 (S)** `single-instance` (registrado primero) + `window-state`.
- [ ] **T1.6 (S)** Menú mínimo y atajos básicos (recargar, zoom, salir). Sin menú de desarrollo en producción.
- [ ] **T1.7 (S)** `lib/desktop/` en el dashboard: `isDesktop()`, `desktop.openExternal()`; **degrada en el navegador**
  (importa `@tauri-apps/*` de forma dinámica y solo ahí). Test con Vitest de que en navegador no se importa nada.
- [ ] **Salida:** `pnpm --filter realsass-dashboard-desktop tauri build` genera un instalador por SO; la app abre el login;
  los enlaces externos se abren en el navegador; los tests Rust pasan.

## Fase 2 — Login por traspaso (backend + front + shell)

**Objetivo:** iniciar sesión en el escritorio sin popup embebido y sin tokens en la URL.

Backend (`realsass-sass-back`, skill `nuevo-procedure-trpc`):
- [ ] **T2.1 (M)** `auth.createDesktopHandoff` (`authProcedure`): input `{ challenge: base64url(S256) , state }`; genera un código
  aleatorio de ≥ 128 bits, lo guarda en Redis ligado a `{ uid, challenge }` con TTL 60 s; devuelve `{ code }`.
- [ ] **T2.2 (M)** `auth.exchangeDesktopHandoff` (mutación **pública**): input `{ code, verifier }`; consume el código de forma
  **atómica** (un solo uso aunque lleguen 20 en paralelo); verifica `S256(verifier) == challenge`; reutiliza
  `AuthService.generateCustomTokenForUid`; audita; devuelve `{ customToken }`. Errores genéricos (no revelar si el código existía).
- [ ] **T2.3 (S)** Rate limit estricto para `auth.exchangeDesktopHandoff` en `IP_RATE_LIMIT` (como `customer.identify`).
- [ ] **T2.4 (S)** Agregar `realsass-sass-back:auth.exchangeDesktopHandoff` a `scripts/audit/public-mutations.allowlist`
  con el motivo (S10).
- [ ] **T2.5 (M)** Tests: unitarios del service; **integración con Redis real**: 20 canjes simultáneos del mismo código ⇒
  exactamente 1 éxito; vence a los 60 s; PKCE incorrecto ⇒ falla y el código **queda quemado**; el código de otro usuario no
  sirve; sin acceso al dashboard ⇒ 403. **Mutación:** desactivar el consumo atómico y comprobar que el test falla.
- [ ] **T2.6 (S)** `pnpm contracts` (el contrato cambia) y typecheck de los 3 fronts.

Front (`realsass-dashboard-front`, skill `nueva-vista-front`):
- [ ] **T2.7 (M)** Página `/login` con `?desktop=1&state&challenge`: tras iniciar sesión en el navegador llama a
  `createDesktopHandoff` y redirige a `realsass-dashboard://auth?code=…&state=…`. Sin `desktop=1`, comportamiento actual.
  **El destino del redirect es SIEMPRE el esquema fijo**: nunca una URL tomada de un parámetro (sería un *open redirect*
  que entrega el código a un tercero). Test: un `redirect=` en la query se ignora.
- [ ] **T2.8 (M)** Página `/auth/desktop`: lee `code` y `verifier` del **fragmento** (`#`, no viaja al servidor), llama a
  `exchangeDesktopHandoff`, `signInWithCustomToken`, y deja que el `AuthProvider` cree la cookie. Limpia el fragmento.
- [ ] **T2.9 (S)** Tests Vitest de ambas páginas (estados cargando / error / éxito; código inválido; fragmento vacío).

Shell (`realsass-dashboard-desktop`):
- [ ] **T2.10 (M)** `deep_link.rs`: registrar el esquema (D0.5); **validar** esquema, host y forma de la URL y el `state`
  contra el generado; rechazar todo lo demás; tests Rust. Generar `verifier`/`challenge` (S256) con una fuente de
  aleatoriedad criptográfica.
- [ ] **T2.11 (S)** Flujo: abrir navegador → esperar deep link → navegar el webview a `/auth/desktop#code=…&verifier=…`.
- [ ] **Salida:** login completo en Windows, macOS y Linux **con la app instalada** (los deep links solo funcionan instalados;
  en macOS desde `/Applications`); el código reutilizado falla; el `verifier` incorrecto falla; cerrar y reabrir la app
  mantiene la sesión.

## Fase 3 — Seguridad (puede solaparse con la 2)

- [ ] **T3.1 (S)** `capabilities/` vacías por defecto; documentar cada permiso agregado con motivo (R2). Revisar R3.
- [ ] **T3.2 (S)** Auditoría **S11** en `scripts/audit/seguridad.sh`: `capabilities/*.json` sin `fs`, `shell`, `http`
  amplios ni permisos de escritura para el origen remoto; `remote.urls` solo el dominio del dashboard; `csp` presente;
  `useHttpsScheme` definido; updater con `pubkey`. **Mutación:** agregar un permiso prohibido y comprobar que S11 falla.
- [ ] **T3.3 (M)** Evaluar el **patrón de aislamiento** de Tauri y decidir (documentar la decisión).
- [ ] **T3.4 (L)** **ADR-026 (CSP con nonces)** en el dashboard: prerrequisito de cualquier capability remota no trivial.
  Si no se implementa, el shell queda sin capabilities remotas.
- [ ] **T3.5 (M)** CI: toolchain Rust, `cargo audit` y `cargo deny` bloqueantes, `Cargo.lock` versionado, `cargo test`,
  `cargo clippy -D warnings`, `cargo fmt --check`.
- [ ] **T3.6 (S)** Ampliar `scripts/audit/dependencias.sh`/`phantom-deps` para que reconozcan el workspace nuevo.
- [ ] **Salida:** S11 y el job de Rust en verde en el CI; cada regla R1–R12 tiene un test o una auditoría.

## Fase 4 — Distribución y actualizaciones

- [ ] **T4.1 (M)** Generar el par de claves del updater; guardar la **privada** en el gestor de secretos con respaldo (D0.7);
  la pública en `tauri.conf.json`; `createUpdaterArtifacts: true`; `requireSignedVersion` activo.
- [ ] **T4.2 (L)** Workflow de release (`tauri-action`) con matriz Windows / macOS / Linux: build, firma (D0.3, D0.4),
  notarización, publicación de instaladores y `latest.json` + `.sig` en GitHub Releases. Secretos solo en el entorno de release.
- [ ] **T4.3 (S)** Versionado compatible con MSI (la versión mayor no puede superar 255; Hoppscotch acorta el año a `26.x.x`).
- [ ] **T4.4 (M)** Canales **staging** y **estable** (endpoint distinto del updater).
- [ ] **T4.5 (M)** Pruebas de actualización: n → n+1 correcta; **firma alterada ⇒ se rechaza**; versión anunciada que no
  coincide con lo firmado ⇒ se rechaza; sin red ⇒ la app sigue funcionando.
- [ ] **T4.6 (S)** Checksums publicados y verificación de la firma dentro del job de CI.
- [ ] **T4.7 (S)** Plan de **rollback** documentado (retirar la release del `latest.json`) y runbook en `roadmap/runbook-incidente.md`.
- [ ] **Salida:** un usuario instala la versión n, publicamos n+1 y se actualiza sola; una n+1 con firma inválida no se instala.

## Fase 5 — Capacidades nativas (solo las priorizadas en D0.1)

Cada capacidad es un ítem propio, con su permiso mínimo, su test y, si cambia el alcance, un ADR corto.

- [ ] **T5.x** Notificaciones de pedidos nuevos (permiso `notification`; origen del evento definido en el back, sin polling agresivo).
- [ ] **T5.x** Impresión / escáner / cajón (si D0.1 lo pide): probablemente exige Modelo B o un comando Rust con alcance cerrado.
- [ ] **T5.x** Bandeja del sistema, arranque con el sistema, atajos globales.
- [ ] **Salida de cada una:** permiso listado en `capabilities/`, S11 en verde, prueba manual por SO.

## Fase 6 — Calidad y cierre

- [ ] **T6.1 (L)** E2E del camino crítico (instalar → login por traspaso → ver pedidos → cerrar y reabrir) con el
  mecanismo elegido en S0.7.
- [ ] **T6.2 (M)** Matriz manual por SO y versión mínima (checklist en este archivo).
- [ ] **T6.3 (S)** Medición de tamaño y memoria frente al spike (S0.1); registrar si empeoró.
- [ ] **T6.4 (S)** Reporte de errores/crash (opt-in) y política de privacidad si se recolecta algo.
- [ ] **T6.5 (S)** Documentar soporte: dónde se guardan los datos locales, cómo desinstalar, cómo reportar fallas.
- [ ] **T6.6 (S)** Actualizar `modules/pilares-audit.md` (pilares 6, 8 y 10) con la evidencia y `cerrar-sesion`.

## Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|:-:|:-:|---|
| La cookie `__session` no funciona o se bloquea en algún webview | Media | Alto | Modelo A la mantiene *first-party*; S0.4 lo prueba antes de escribir producto |
| Google bloquea OAuth en webview embebido | Alta | Medio | Por diseño el login va por el navegador del sistema (R5); S0.3 lo documenta |
| Un XSS del dashboard hereda permisos del shell | Baja | Alto | Capabilities vacías (R2/R3); S11; ADR-026 antes de cualquier permiso remoto no trivial |
| Se pierde la clave privada del updater | Baja | Crítico | D0.7: gestor de secretos + respaldo; el riesgo se acepta por escrito |
| Diferencias entre WebView2 / WKWebView / WebKitGTK rompen la UI | Media | Medio | S0.2 y T6.2; baseline documentado; no usar APIs sin soporte |
| SmartScreen / Gatekeeper asustan a los usuarios | Alta | Medio | Firma y notarización (D0.3, D0.4); firmar siempre con el mismo certificado |
| Rust amplía la superficie de dependencias | Media | Medio | R9: `cargo audit`/`cargo deny` bloqueantes, `Cargo.lock`, dueños |
| Cambiar el origen del webview pierde las sesiones | Baja | Medio | R11: fijar `useHttpsScheme` e identificador antes del primer release |
| El costo (Apple, firma, mantenimiento) no se justifica frente a una PWA | Media | Alto | D0.1 obliga a nombrar la capacidad nativa; si no existe, se rechaza el ADR |

## Impacto en los pilares (`modules/pilares-audit.md`)

Pilar 6 (entrega): suma releases firmadas y un updater, y también una superficie nueva a mantener.
Pilar 8 (frontend): baseline de webviews y e2e. Pilar 10 (producto): suma una forma de uso. Pilar 3 (seguridad): suma la
Fase 3. **No se re-puntúa hasta que haya evidencia ejecutada.**

## Registro de decisiones y resultados del spike

*(se completa en la Fase 0)*

| Fecha | Ítem | Resultado | Evidencia |
|---|---|---|---|
| | | | |
