---
name: cerrar-sesion
description: Usar al terminar una sesión de trabajo o un bloque de cambios para actualizar la documentación dinámica de .claude (deuda técnica, sprints, estado de servicios) con evidencia verificada, sin tocar los documentos de contrato.
---

# Cerrar la sesión

**Problema que resuelve:** la lista de deuda se desactualiza (ítems marcados pendientes que ya estaban resueltos, o al revés).
Cada línea que se cierra o abre lleva evidencia, no memoria.

## Qué se puede editar y qué no (`CLAUDE.md`, "Contrato vs snapshot")

| Grupo | Archivos | Regla |
|---|---|---|
| 🔄 Dinámicos | `roadmap/sprints.md`, `roadmap/deuda-tecnica.md`, `services/*.md` | Se actualizan en cada sesión |
| 🔒 Contrato | `architecture/`, `contracts/`, `decisions/ADR-*.md` | **No se editan** para que cuadren con el código. Un cambio de decisión = un **ADR nuevo** (plantilla `decisions/TEMPLATE.md`) |
| Generado | `ecosistema.xml`, `ecosistema-infra.xml` | No se editan: se regeneran con `make r` |

## Pasos

1. Reconstruir qué pasó: `git status`, `git diff --stat`, y lo ejecutado en la sesión.
2. Por cada ítem de deuda que parece resuelto: **comprobarlo** (test, comando, grep) antes de tildar. Si no se puede comprobar,
   queda abierto con una nota "no verificado".
3. Agregar arriba de `deuda-tecnica.md` una sección fechada `## Sesión AAAA-MM-DD — <tema>` con:
   - **Cerrado ✅** (con la evidencia: comando o test),
   - **Pendiente derivado** (lo que la sesión descubrió),
   - cómo reproducir lo nuevo si hace falta (comandos locales).
4. Actualizar "Última actualización" y los `services/*.md` afectados (estado actual, no historia).
5. Si algo contradice un ADR o un contrato → **no editarlo**; proponer un ADR nuevo y dejarlo como pendiente.
6. Revisar lo cruzado: IDs de deuda (`DT-…`, `WEL-…`) sin duplicar; nada contradictorio entre secciones.
7. **No commitear ni pushear** salvo que el usuario lo pida. Resumir los archivos tocados.

## Reporte final (corto)

```
Cerrado: …  (evidencia)
Abierto: …  (por qué)
No verificado: …
Docs actualizadas: …
```

## Verificación final

- [ ] Cada ✅ tiene evidencia reproducible
- [ ] Ningún archivo de contrato modificado (`git diff --stat -- .claude/architecture .claude/contracts .claude/decisions`)
- [ ] Fecha y alcance de la sesión correctos

## Mantenimiento

Depende de la sección "Contrato vs snapshot" de `.claude/CLAUDE.md`. Si cambia esa clasificación, actualizar la tabla.
