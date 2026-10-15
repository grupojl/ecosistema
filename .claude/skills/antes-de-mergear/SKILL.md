---
name: antes-de-mergear
description: Usar antes de mergear, abrir un PR o dar un cambio por terminado en este monorepo. Corre lo mismo que el CI, revisa las reglas duras sobre el diff y reporta qué pasó y qué no, sin afirmar nada que no haya ejecutado.
---

# Antes de mergear

**Regla madre:** nunca decir "listo" sin haber ejecutado cada chequeo. Si algo no se pudo correr, se reporta como **no verificado**, con el motivo.

## 1. Alcance

`git status` y `git diff --stat`: qué back, front o package se tocó. Decide qué chequeos son críticos.

## 2. Chequeos (orden del CI; los 5 jobs de `ci.yml`)

| Job | Comando (raíz) | Notas |
|---|---|---|
| quality | `pnpm contracts` → `pnpm lint` → `pnpm typecheck` → `pnpm build` | Orden fijo (ADR-019). `pnpm check` los encadena con los tests |
| tests | `pnpm test:ci` | Falla si la cobertura baja del umbral. Si sube, subir el umbral en `jest.config.js` (solo suben) |
| integration | `pnpm test:int` con `TEST_DATABASE_URL` local | Requiere Postgres local con migraciones (skill `nueva-migracion`). Si no hay, **no verificado** |
| dependencies | `pnpm audit:deps` | high/critical = bloqueante |
| audits | `bash scripts/audit/run.sh --ci` | Las 7 auditorías (arquitectura, seguridad, testing, dependencias, deploy…) |

Nunca correr nada contra la `DATABASE_URL` del `.env` (Railway).

## 3. Reglas duras sobre el diff (`architecture/03-reglas-duras.md`)

Buscar solo en lo que cambió (`git diff -U0`):
- 🔴 Query Prisma sin `organizationId` en el `where` → bloquea.
- 🔴 `as any`, `as unknown as`, `@ts-ignore` fuera de dobles de test → bloquea.
- 🔴 `class-validator`/`class-transformer`/`joi` → Zod es la única validación.
- 🔴 `fetch` manual, `useEffect` que trae datos, controller REST de negocio nuevo (ADR-005).
- 🔴 Versión hardcodeada en `package.json` (solo `catalog:` / `workspace:*`) o import sin declarar.
- 🟡 Módulo nuevo sin tests; dependencia nueva sin checklist R4 (skill `nueva-dependencia`).
- Higiene: sin `*.bak`, `*PATCH.md`, `.env*` reales, secretos (el hook de pre-commit también lo frena).

## 4. Documentación dinámica

¿El cambio cierra o abre deuda? → skill `cerrar-sesion`. Los contratos (`architecture/`, `contracts/`, `decisions/ADR-*`) **no se editan** para que cuadren con el código.

## 5. Reporte (formato fijo)

```
Chequeo            Resultado     Evidencia
contracts          ✅ / ❌ / ⏭   (salida clave)
lint / typecheck   …
tests + cobertura  …             (n pasados, umbral)
integración        …             (o "no verificado: sin Postgres local")
audit deps / repo  …
Reglas duras       …             (hallazgos con archivo:línea)
```

Cerrar con: **¿se puede mergear? Sí / No / Con reservas** y por qué. Mientras el CI nunca haya corrido en GitHub, decirlo.

## Mantenimiento

Depende de `.github/workflows/ci.yml` (si cambian los jobs, actualizar la tabla), ADR-022 y `architecture/03-reglas-duras.md`.
