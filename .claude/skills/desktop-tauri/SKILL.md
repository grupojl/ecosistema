---
name: desktop-tauri
description: Usar al crear o modificar la app de escritorio del dashboard (workspace realsass-dashboard-desktop, src-tauri, capabilities, deep links, updater, firma de binarios) o el adaptador lib/desktop del dashboard. Aplica el norte de architecture/14 y el ADR-028. NO usar para cambios del dashboard web que no tocan el escritorio.
---

# Escritorio con Tauri (ADR-028)

> El escritorio es una distribución nativa del dashboard, no un segundo producto. Lo que corre en el webview no es de
> confianza; lo que corre en Rust sí; entre los dos hay una puerta con lista de permisos.

**Antes de empezar, leer:** `architecture/14-desktop-tauri-norte.md` (reglas R1–R12) y el estado en `roadmap/desktop-tauri.md`.
Si el ADR-028 sigue **Propuesto**, el trabajo permitido es el de la **Fase 0** (spike descartable). No empezar a escribir código de
producto hasta que pase a **Aceptado**.

## Pedir confirmación al usuario antes de

- instalar una dependencia (npm **o** crate) → además aplica la skill `nueva-dependencia` (catalog, R4, `minimumReleaseAge`);
- crear cuentas, claves o secretos (Apple Developer, certificados de Windows, clave del updater);
- agregar una **capability** o ampliar una existente;
- publicar una release o tocar el endpoint del updater;
- cambiar el identificador de la app, el esquema de deep link o `useHttpsScheme` (R11: se pierden los datos locales).

## Reglas que se revisan en cada cambio

1. **R1** Rust no tiene lógica de negocio. Si hace falta una regla, va al back (tRPC).
2. **R2/R3** Sin capabilities por defecto. Para el dominio remoto, prohibidos `fs`, `shell`, `http` amplio, `process`, `os-info`
   y todo permiso de escritura. Toda capability nueva: motivo + alcance mínimo + test.
3. **R4** El webview solo navega al dominio del dashboard; lo externo, al navegador (`opener`). El decisor es una función pura
   con tests.
4. **R5/R6** El login de Google **nunca** en un webview embebido; navegador del sistema + código de un solo uso + PKCE. Sin
   tokens en `localStorage` ni en la URL; el código viaja en el **fragmento**.
5. **R7** Todo deep link se valida (esquema, host, forma, `state`) antes de usarse. El destino del redirect del login es el
   esquema fijo, nunca un parámetro.
6. **R8** Updater firmado, `requireSignedVersion`, clave privada fuera del repo.
7. **R9** Rust bajo la política de dependencias: `Cargo.lock` versionado, `cargo audit` y `cargo deny` bloqueantes.
8. **R10** Nada fuera de `lib/desktop/` importa `@tauri-apps/*`; el dashboard web sigue funcionando en un navegador.

## Procedimiento

### A. Agregar una capacidad nativa
1. Confirmar que la necesidad está priorizada (`roadmap/desktop-tauri.md`, D0.1) y que **no** se resuelve con la web.
2. Definir el permiso **mínimo** (identificador `plugin:permiso`) y el alcance (ventana, URL, plataformas).
3. Escribirlo en `src-tauri/capabilities/<nombre>.json` con `windows` y, si es remoto, `remote.urls` solo con el dominio del
   dashboard. No mezclar capabilities en una misma ventana sin revisar el efecto (se suman los permisos).
4. Exponerlo en `lib/desktop/` con una función que **degrada** en el navegador (devuelve "no disponible", no lanza).
5. Test: Rust (lógica) + Vitest (adaptador en navegador) + la auditoría **S11**. **Mutación:** agregar un permiso prohibido y
   comprobar que S11 falla.
6. Si cambia el alcance del producto, un ADR corto.

### B. Agregar un comando de Rust
1. ¿Puede ser un permiso de un plugin oficial? Entonces no escribir un comando propio.
2. Si hace falta: validar **todos** los argumentos como no confiables (vienen del webview), alcance cerrado, sin acceso al
   sistema de archivos fuera de una ruta fija, errores sin detalles internos.
3. Declararlo en el manifiesto de la app para que quede bajo el control de capabilities (los comandos propios sin manifiesto
   pueden saltearse el ACL en versiones anteriores a Tauri 2.11.1; fijar una versión posterior).

### C. Cambiar el login por traspaso
1. Leer ADR-028 §Decisión 2. Backend: `auth.createDesktopHandoff` / `auth.exchangeDesktopHandoff` (skill `nuevo-procedure-trpc`).
2. Invariantes que no se rompen: código ≥ 128 bits, TTL 60 s, **consumo atómico** (un solo uso), PKCE S256, errores genéricos,
   rate limit estricto, auditoría, y el deep link **no** lleva el token de Firebase.
3. Tests obligatorios: 20 canjes simultáneos ⇒ 1 éxito (Redis real), vencimiento, PKCE inválido quema el código, usuario sin acceso.

### D. Release
1. Nunca publicar sin confirmación explícita. 2. Todo pasa por el workflow de `tauri-action`. 3. Verificar firma y notarización en el
job. 4. Probar la actualización n → n+1 **y** la firma alterada antes de promover a estable.

## Verificación antes de dar el cambio por terminado

```bash
# Rust (en realsass-dashboard-desktop/src-tauri)
cargo fmt --check && cargo clippy -- -D warnings && cargo test && cargo audit && cargo deny check
# Monorepo
pnpm lint && pnpm typecheck && pnpm test:ci
bash scripts/audit/run.sh --ci          # incluye S10 y S11
# Si tocó el backend o el contrato
pnpm contracts
```
Y una **prueba manual con la app instalada** (los deep links solo funcionan instalados) en cada sistema operativo afectado.
Reportar lo que se corrió y lo que **no** se pudo correr; nunca afirmar un resultado que no se ejecutó.

## Fuera de alcance de esta skill
Cambios en el dashboard web sin relación con el escritorio (`nueva-vista-front`), migraciones (`nueva-migracion`),
despliegue del dashboard a Railway (`deploy-staging`).
