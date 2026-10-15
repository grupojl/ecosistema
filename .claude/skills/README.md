# Skills del proyecto

> Estado: ✅ 12 skills escritas · 3 sin probar de punta a punta (staging real, incidente real, ADR-028 aún Propuesto)
> Última actualización: 2026-10-15

Una skill es un procedimiento que Claude carga cuando la tarea coincide con su `description`. **Los ADRs son el qué y el por qué
(contrato); las skills son el cómo.** Una skill apunta al ADR, no lo copia.

## Catálogo

| Grupo | Skill | Cuándo se usa | Verificación final | Probada |
|---|---|---|---|---|
| Backend | [`nueva-migracion`](nueva-migracion/SKILL.md) | Cambiar `schema.prisma`, crear migración | `migrate deploy` + `migrate diff` sin deriva | ✅ 2026-10-15 |
| Backend | [`nuevo-procedure-trpc`](nuevo-procedure-trpc/SKILL.md) | Crear/cambiar un procedure o router | `pnpm contracts` + typecheck + 401/403 | ◐ sigue patrones existentes |
| Backend | [`nuevo-modulo-nest`](nuevo-modulo-nest/SKILL.md) | Módulo con domain/repository/service | auditoría `arquitectura` + test de tenant | ◐ sigue el molde `catalog/` |
| Seguridad | [`test-integracion-tenant`](test-integracion-tenant/SKILL.md) | Tests con Postgres real: tenant, concurrencia | `pnpm test:int` + mutación en rojo | ✅ 16 tests, 2026-10-15 |
| Seguridad | [`revisar-seguridad`](revisar-seguridad/SKILL.md) | Revisar un cambio contra ADR-023 | `seguridad.sh` + tests de seguridad | ◐ lista basada en ADR-023/024 |
| Frontend | [`nueva-vista-front`](nueva-vista-front/SKILL.md) | Páginas/vistas en los 3 fronts | lint + typecheck + build + 3 anchos | ◐ sigue `02-frontend-capas.md` |
| Calidad | [`antes-de-mergear`](antes-de-mergear/SKILL.md) | Antes de mergear o dar por terminado | los 5 jobs del CI + reglas duras | ✅ los comandos se corrieron hoy |
| Calidad | [`nueva-dependencia`](nueva-dependencia/SKILL.md) | Agregar/mover/quitar dependencias | `phantom-deps` + `audit:deps` + frozen-lockfile | ◐ sigue ADR-018 |
| Escritorio | [`desktop-tauri`](desktop-tauri/SKILL.md) | Shell Tauri, capabilities, deep links, updater, firma (ADR-028) | `cargo test/clippy/audit/deny` + S10/S11 + prueba con la app instalada | ❌ ADR-028 aún Propuesto |
| Operación | [`deploy-staging`](deploy-staging/SKILL.md) | Preparar/validar un deploy a Railway | 5 `docker build` + `/health` + humo | ❌ sin staging |
| Operación | [`runbook-incidente`](runbook-incidente/SKILL.md) | Algo falla en producción | mitigación + postmortem + test | ❌ sin incidente real |
| Docs | [`cerrar-sesion`](cerrar-sesion/SKILL.md) | Terminar una sesión de trabajo | evidencia por ítem, contratos intactos | ✅ aplicada 2026-10-15 |

Leyenda: ✅ ejecutada de punta a punta · ◐ los pasos replican código/comandos existentes pero la skill como tal no se ejecutó · ❌ no se puede probar todavía.

## Formato

```
.claude/skills/<nombre>/SKILL.md
---
name: <igual a la carpeta, kebab-case>
description: <cuándo usarla, concreto; de acá depende que Claude la elija>
---
```

## Reglas

1. Nace de algo que se repite o de un error que ya costó. No "por si acaso".
2. Una skill = un procedimiento con un resultado **verificable**: termina con una lista de chequeos que se ejecutan.
3. Falla cerrado: si no puede verificar algo, para y lo dice ("no verificado"); nunca afirma un resultado que no corrió.
4. Nunca ejecuta nada contra la `DATABASE_URL` del `.env` (apunta a Railway). Solo bases locales con URL explícita.
5. Las acciones externas (push, deploy, variables de Railway, migraciones remotas) piden confirmación cada vez.
6. Tiene un caso de prueba real y una línea **Mantenimiento** con los ADRs de los que depende; se revisa cuando cambian.
7. Máximo ~12 skills: más se pisan al elegir. Antes de crear una nueva, ver si amplía una existente.
8. Una skill de terceros se lee completa antes de instalarse (es texto que Claude obedece con acceso al repo).

## Mantenimiento del conjunto

- Cambia un ADR o el CI → revisar las skills de su línea **Mantenimiento**.
- Cada incidente o bug nuevo aporta una regla: a la skill que corresponda, no a una nueva.
- Pasar `deploy-staging` y `runbook-incidente` a ✅ en cuanto exista un staging real; hasta entonces son hipótesis ordenadas.
- Subir una skill de ◐ a ✅ = usarla una vez en una tarea real y corregir lo que falle.
