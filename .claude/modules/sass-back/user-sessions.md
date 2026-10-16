# Módulo: user-sessions (sesiones y dispositivos)

> Estado: F1 y F2 ✅ implementadas, F3 🔲 (ADR-020). Contrato: `contracts/user-sessions.md`.

## ¿Qué hace en palabras simples?

Lleva la cuenta de los lugares desde donde entraste: "Chrome en Windows, Buenos Aires,
hace 10 minutos". Si ves uno que no reconocés, lo cerrás sin sacar al resto. Es la pantalla
"Sesiones" de GitHub.

## ¿Qué problemas resuelve?

- "¿Alguien más entró a mi cuenta?" → lista de sesiones activas
- "Dejé la sesión abierta en una PC ajena" → cerrar esa sesión puntual
- "Entró un equipo nuevo" → aviso por mail (F3)

## Funciones

- **Registrar** una sesión al crear la cookie (`POST /auth/session`).
- **Listar** las sesiones activas, marcando la actual (`sessions.list`).
- **Cerrar** una (`sessions.revoke`) o todas las demás (`sessions.revokeOthers`) — F2.
- **Cerrar la sesión actual** desde el propio modal (botón "Cerrar sesión" en "Este dispositivo"): hace lo mismo que
  el menú de usuario, o sea revoca todos los tokens del usuario (cierra también los otros dispositivos).
- **Avisar** por mail de un dispositivo nuevo — F3.

## Dónde vive

- Modelo y router: `realsass-sass-back` (`src/sessions/`, `src/trpc/routers/sessions.router.ts`).
  Migración `20261016120000_user_sessions`. User-Agent → dispositivo en `device-info.ts` (sin dependencias).
- Cookie `__sid` emitida en `auth-session-throttled.controller.ts`; opción `isSessionRevoked` en
  `@real/auth-server` (`session/`, middleware).
- UI: modal `DevicesDialog` (`packages/ui`), conectado por `components/devices-dialog-connected.tsx` en
  `realsass-dashboard-front` (menú de usuario del sidebar → "Dispositivos") y `realsass-sass-front`
  (`/profile`, botón junto a "Cerrar sesión").

## Sesión en vivo entre fronts

Cerrar sesión en un front cierra en todos; abrirla en uno abre en los demás (al volver a la pestaña o en ≤30 s).
Detalle y reglas en `contracts/user-sessions.md` → "Sesión en vivo entre fronts".

## Fases

| Fase | Estado |
|---|---|
| F1 registro + lista | ✅ |
| F2 revocar por sesión / las demás | ✅ |
| F3 mail de dispositivo nuevo | 🔲 |
