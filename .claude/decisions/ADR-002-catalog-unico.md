# ADR-002: Catalog único de pnpm en vez de named catalogs

**Fecha:** (documentado en instrucciones del proyecto)
**Estado:** Aceptado — restricción de entorno, no preferencia de diseño

## Contexto

pnpm soporta "named catalogs" (`catalog:backend`, `catalog:frontend`,
`catalog:trpc`) para agrupar versiones de dependencias por dominio. En este
entorno (Windows + Git Bash, pnpm 10.30.3, Node 24.14.0) **los named catalogs
no funcionan** — dan error.

## Decisión

Usar SIEMPRE un solo `catalog:` default para todo el ecosistema en
`pnpm-workspace.yaml`. Cualquier `catalog:algo` encontrado en un
`package.json` es un bug y debe normalizarse a `catalog:`.

## Alternativas descartadas

- Named catalogs por dominio (backend/frontend/trpc) — más prolijo
  conceptualmente, pero no funciona en este entorno específico. No se
  investigó a fondo la causa raíz (posible incompatibilidad de versión de
  pnpm o de la feature en este SO) porque el catalog único resuelve el
  bloqueo sin costo funcional real.

## Consecuencias

- Un solo bloque `catalog:` en `pnpm-workspace.yaml` con todas las versiones
  (backend + frontend + trpc mezcladas).
- Ganancia: elimina el bug de raíz, cero fricción.
- Costo: el archivo `pnpm-workspace.yaml` es más largo y menos "organizado
  por dominio" a simple vista.
- Si en el futuro se actualiza pnpm/Node y los named catalogs empiezan a
  funcionar, evaluar si vale la pena volver a partirlos — no es urgente.

## Referencias

`pnpm-workspace.yaml`, instrucciones del proyecto (`ecosistema-infra.xml`,
sección `<instruction>`).
