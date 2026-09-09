# CONTEXT.md — Estado de la sesión activa

**Repo:** grupojl/welver
**Score actual:** 5.42/10 — medido el 2026-09-09 por `./x.sh docs`
**Anterior:** 9.01 (delta -3.59)

---

## Sesión activa

**Objetivo de esta sesión:**
_(actualizar al empezar)_

**Bloqueante actual:**
`realsass-sass-front/lib/config-client.ts` importa `AppRouter`, símbolo que `@real/trpc` no exporta (TS2305). Ese front no compila.

**Última decisión tomada:**
El score lo calcula `x.sh docs` midiendo el repo. Un ADR marcado ✅ Implementado
no es evidencia — sólo el conteo lo es.

**Próximo paso concreto:**
`./x.sh ecommerce-back --dry-run`, revisar el diff, después typecheck del servicio.

---

## Estado por dimensión

| Dimensión | Score |
|---|---|
| TypeScript Strict | 1.0 |
| Arquitectura de capas | 5.5 |
| Frontend | 5.5 |
| Seguridad | 8.9 |
| Config/entorno | 7.3 |
| CI/CD y tests | 5.9 |
| Deuda técnica | 4.6 |

---

## Cómo cerrar una sesión

1. Actualizar las 4 líneas de "Sesión activa" arriba.
2. Correr `./x.sh docs` — regenera este archivo y `AUDIT-LAST.md` con el score real.
3. Agregar las decisiones del día a `DECISIONS-LOG.md`.

---

## Historial de sesiones

| Fecha | Objetivo | Score al cerrar |
|-------|----------|-----------------|
| 2026-09-08 | Setup del sistema de auditoría | 9.01 (declarado) |
| 2026-09-09 | Auditoría por medición automática | 5.42 (medido) |
