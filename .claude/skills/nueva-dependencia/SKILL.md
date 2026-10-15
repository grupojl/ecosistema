---
name: nueva-dependencia
description: Usar antes de agregar, subir de versión, mover o quitar una dependencia npm en cualquier package.json del monorepo, o al ver errores de dependencias fantasma. Aplica la política única ADR-018 (catalog, strict deps, checklist R4).
---

# Nueva dependencia (ADR-018)

> Toda dependencia es código ajeno que corre con nuestros permisos: entra con dueño, con una sola versión y declarada donde se usa.

**Agregar una dependencia es una decisión de cadena de suministro: pedir confirmación al usuario antes de instalarla.**

## Antes de instalar

1. ¿Lo resuelve Node/Web estándar o algo que ya está en el `catalog:`? Si sí, no agregar.
2. ¿Ya existe otra librería para lo mismo? Un solo cliente Redis, un validador (Zod), un logger.
3. Checklist **R4** (va en la descripción del PR; marcar solo lo que se verificó de verdad):
   ```
   [ ] No hay alternativa estándar o ya instalada
   [ ] Mantenimiento: release en los últimos 12 meses
   [ ] Licencia MIT/Apache-2.0/BSD/ISC (GPL/AGPL/SSPL bloqueado; otra, consultar)
   [ ] OpenSSF Scorecard ≥ 6 (deps.dev) o justificación
   [ ] Costo: transitivas y, en front, peso en el bundle
   [ ] Tipos propios o @types mantenido
   [ ] Dueño interno asignado
   [ ] Agregada al catalog y referenciada con catalog:
   ```
   Lo que no se pueda comprobar sin red o sin la fuente, se marca **"no verificado"**, nunca como cumplido.

## Pasos

1. Agregar primero al `catalog:` de `pnpm-workspace.yaml` (sin catálogos con nombre: restricción de Windows + Git Bash).
2. En el `package.json` del workspace que **importa** el paquete: `"pkg": "catalog:"` (o `workspace:*`). Nada de `^`/`~`/versiones fijas.
3. Declarar donde se usa: tipos (`@types/*`) y tooling en `devDependencies`; imports dinámicos también.
4. `packages/*`: `react`, `react-dom`, `@nestjs/*`, `firebase-admin`, `@prisma/client` van en `peerDependencies` + `devDependencies`, nunca en `dependencies`.
5. `pnpm install` (actualiza el lockfile a propósito; el CI usa `--frozen-lockfile`) y commitear el lockfile.
6. Quitar es libre y preferible ante la duda; limpiar el `catalog:` de entradas sin consumidor.

## Verificación final

- [ ] `pnpm install --frozen-lockfile` pasa con el lockfile nuevo
- [ ] `bash scripts/audit/run.sh dependencias` (incluye `phantom-deps.cjs`) → 0 hallazgos
- [ ] `pnpm audit:deps` → sin vulnerabilidades high/critical
- [ ] `pnpm contracts && pnpm build` si la dependencia llega a un servicio desplegable
- [ ] Si la versión hardcodeada: `grep -rnE '^\s*"[^"]+":\s*"(\^|~|[0-9])' --include=package.json . --exclude-dir=node_modules | grep -vE '"version"'` → vacío

## Mantenimiento

Depende de ADR-018, `architecture/11-dependencias-norte.md` y ADR-022. Excepciones vigentes se registran en el norte, no acá.
