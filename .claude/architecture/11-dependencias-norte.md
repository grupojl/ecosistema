# 11 — Norte de dependencias: qué entra al monorepo y cómo se mantiene

> Referentes: **Google** (*Software Engineering at Google*, cap. 21 — One Version Rule,
> ownership, strict deps) · **Microsoft Rush** (phantom dependencies y doppelgangers en
> monorepos JS) · **OpenSSF / SLSA** (cadena de suministro verificable).
>
> Decisión formal: `decisions/ADR-018-politica-dependencias.md`

---

## El principio

> "Toda dependencia es código ajeno que corre con nuestros permisos:
> entra con dueño, con una sola versión y declarada donde se usa."

No copiamos el modelo de Google literalmente (vendoring de todo `third_party/` + Bazel
hermético): el costo de infraestructura es desproporcionado para nuestra escala.
Trasladamos los principios y los ejecutamos con pnpm, Renovate y CI.

---

## De principio a regla

| Principio (referente) | Qué significa | Regla aquí |
|---|---|---|
| One Version Rule (Google) | Una sola versión de cada paquete en todo el repo | R1 |
| Strict deps (Google / Bazel) | Solo usás lo que declaraste | R2 |
| Doppelgangers (Rush) | Dos copias del mismo paquete rompen singletons | R3 |
| Agregar tiene costo (Google) | Cada dependencia es deuda de mantenimiento | R4 |
| Live at head (Google) | Upgrades chicos y continuos; quien sube, migra | R5 |
| Supply chain (SLSA / OSV) | Origen verificable, vulnerabilidades visibles | R6 |
| Ley de Hyrum (Google) | Todo comportamiento observable se vuelve contrato | R3 |

---

## R1 — Una sola versión (catalog)

- Todo `package.json` usa `catalog:` o `workspace:*`. Nada más.
- Una dependencia nueva se agrega **primero** al `catalog:` de `pnpm-workspace.yaml`
  y después se referencia.
- Named catalogs (`catalog:algo`) prohibidos — restricción de entorno Windows + Git Bash
  (welver ADR-002).
- Una sola librería por responsabilidad: un cliente Redis, un validador, un logger.
  Dos librerías para lo mismo es la One Version Rule violada a nivel de concepto.
- Excepción automática: rangos en `peerDependencies` de `packages/*` (ej: `"react": ">=19.0.0"`).
- Cualquier otra excepción se registra en **Excepciones vigentes** (abajo), con motivo
  y fase de revisión.

```bash
# versiones hardcodeadas → 0 salvo excepciones registradas
grep -rnE '^\s*"[^"]+":\s*"(\^|~|[0-9])' --include=package.json . \
  --exclude-dir=node_modules | grep -vE '"version"'

# claves de paquete inválidas (scope perdido por un reemplazo mal escapado) → 0
grep -rnE '^\s*"[/-][^"]*":' --include=package.json . --exclude-dir=node_modules
```

---

## R2 — Declarado donde se usa (strict deps)

- Si un archivo de `X/src` importa `pkg`, entonces `pkg` está en `X/package.json`,
  aunque "funcione" porque otro workspace lo trae.
- `shamefully-hoist=true` **enmascara** este error: el build pasa hasta que cambia el
  builder de Railway, se usa `pnpm deploy --filter`, o el workspace que traía el paquete
  lo elimina.
- Los tipos cuentan: si importás `Request` de `express`, declarás `@types/express` (dev).
- Los imports dinámicos (`await import('pkg')`) también se declaran: compilan sin el
  paquete y fallan en runtime.

```bash
pnpm dlx knip --dependencies                        # todo el monorepo
pnpm dlx knip --dependencies --workspace <nombre>   # un workspace
```

Meta de F2: `shamefully-hoist=false`, con `public-hoist-pattern` solo para lo que la
tooling exija, documentado en Excepciones.

---

## R3 — Librerías internas (`packages/*`)

- Frameworks y singletons (`react`, `react-dom`, `@nestjs/*`, `firebase-admin`,
  `@prisma/client`) van en `peerDependencies` + `devDependencies`, **nunca** en `dependencies`.
- Motivo: si la lib los trae en `dependencies`, pnpm puede resolver una segunda copia →
  "Invalid hook call" en React, metadata de DI rota en Nest, dos instancias de Firebase Admin.
- Las dependencias propias de la lib (ej: `superjson` en el package de tRPC) sí van en
  `dependencies`.
- Los consumidores importan solo el entrypoint de la lib — nunca `@scope/lib/src/interno`.

---

## R4 — Agregar una dependencia

Checklist obligatorio en la descripción del PR:

```
[ ] ¿Lo resuelve Node/Web estándar o una dependencia que ya tenemos?
[ ] ¿Ya existe otra librería para lo mismo en el catalog? (un cliente, un validador, un logger)
[ ] Mantenimiento: release en los últimos 12 meses, issues con respuesta
[ ] Licencia: MIT / Apache-2.0 / BSD / ISC → OK · GPL / AGPL / SSPL → bloqueado · otra → consultar
[ ] OpenSSF Scorecard ≥ 6 (deps.dev) — o justificación explícita
[ ] Costo: dependencias transitivas; en front, peso en el bundle
[ ] Tipos: trae los suyos o hay @types mantenido
[ ] Dueño interno: quién responde por upgrades y CVEs
[ ] Agregada al catalog y referenciada con catalog:
```

Quitar una dependencia no requiere checklist. Ante la duda, preferimos borrar.

---

## R5 — Upgrades continuos (Renovate)

- Renovate actualiza el `catalog:` de `pnpm-workspace.yaml`: un PR mueve a todos los
  consumidores a la vez.
- Un grupo = un PR: NestJS, Prisma, OpenTelemetry, React/Next, tRPC, Radix.
- Cadencia semanal. Los majors requieren aprobación manual en el Dependency Dashboard.
- Quien mergea un upgrade arregla a todos los consumidores en el mismo PR ("live at head").
- PR de Renovate abierto más de 14 días = deuda con ticket.

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":dependencyDashboard"],
  "timezone": "America/Argentina/Buenos_Aires",
  "schedule": ["before 6am on monday"],
  "minimumReleaseAge": "3 days",
  "packageRules": [
    { "groupName": "nestjs",        "matchPackageNames": ["@nestjs/**"] },
    { "groupName": "prisma",        "matchPackageNames": ["prisma", "@prisma/**"] },
    { "groupName": "opentelemetry", "matchPackageNames": ["@opentelemetry/**"] },
    { "groupName": "react-next",    "matchPackageNames": ["react", "react-dom", "next", "@types/react", "@types/react-dom"] },
    { "groupName": "trpc",          "matchPackageNames": ["@trpc/**"] },
    { "groupName": "radix",         "matchPackageNames": ["@radix-ui/**"] },
    { "matchUpdateTypes": ["major"], "dependencyDashboardApproval": true }
  ]
}
```

---

## R6 — Cadena de suministro

- `pnpm install --frozen-lockfile` en CI y en el build de Railway. Si el lockfile no
  coincide, el build falla — es lo correcto.
- `minimumReleaseAge`: no instalar versiones publicadas hace menos de 3 días (ventana
  típica de detección de paquetes comprometidos).
- Lifecycle scripts: reemplazar `ignore-scripts=true` global por la allowlist
  `onlyBuiltDependencies`. El flag global también apaga scripts que sí necesitamos y
  obliga a pasos manuales en el build.
- Vulnerabilidades: OSV-Scanner en CI; high/critical abiertas más de 7 días = bloqueante.
- Licencias: `pnpm licenses list --prod` en CI contra la lista de R4.

```yaml
# pnpm-workspace.yaml — F2, validar en un deploy de Railway antes de activar
minimumReleaseAge: 4320   # minutos = 3 días
onlyBuiltDependencies:
  - prisma
  - "@prisma/engines"
  - esbuild
```

---

## Métricas de 10/10

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| Versiones fuera del catalog | 0 (salvo Excepciones) | grep de R1 |
| Phantom deps / deps sin uso | 0 | `knip --dependencies` |
| Versiones por paquete en el lockfile | 1 | `pnpm dedupe --check` |
| Vulnerabilidades high/critical | 0 con más de 7 días | OSV-Scanner |
| Install reproducible | 100% de los builds | `--frozen-lockfile` en CI y Railway |
| Deps nuevas con Scorecard ≥ 6 | 100% o justificadas | checklist R4 |
| PRs de Renovate | mergeados en < 14 días | Dependency Dashboard |
| Núcleo alineado entre repos | misma major/minor de Node, TS, Nest, Prisma, React, Next | comparación de catalogs (F3) |

---

## Estado al 2026-09-22 (baseline welver)

| Métrica | Hoy | Objetivo |
|---|---|---|
| Versiones fuera del catalog | 10 (7 en sass-back, 3 en sass-front) | 0 |
| Imports sin declarar en ningún workspace | 1 (`@nestjs-modules/ioredis`) | 0 |
| Phantom deps enmascaradas por hoisting | 3 (`express` ×2, `firebase`) | 0 |
| Libs con frameworks en deps + peer | 2 (`@real/auth-server`, `@real/ui`) | 0 |
| Entradas del catalog sin consumidor | 15 | 0 |
| Prisma | ^7.4.2 | núcleo alineado (F3) |

## Excepciones vigentes

| Paquete | Workspace | Motivo | Revisión |
|---|---|---|---|
| — | — | Ninguna registrada. Los rangos de `peerDependencies` en `packages/*` son la única excepción automática. | — |

---

## Plan de adopción

### F0 — Bloqueantes (antes de cualquier otra fase)

- [ ] `realsass-ecommerce-back`: declarar `@nestjs-modules/ioredis` (catalog + package.json)
      o reemplazarlo por un provider propio sobre `ioredis`, que ya está en el catalog.
      Decidir en el PR; preferible un solo patrón de cliente Redis en todo el repo.
- [ ] `realsass-sass-back`: alinear los 6 `@opentelemetry/*` al catalog (agregar
      `exporter-trace-otlp-grpc`, `resources` y `semantic-conventions` con versiones
      compatibles con `sdk-node` 0.57).
- [ ] Llevar `@types/qs`, `next-themes`, `postcss` y `tw-animate-css` a `catalog:`.
- [ ] `realsass-dashboard-front`: el import directo de `firebase` contradice la regla 🔵
      "usar siempre `@real/auth-client`". Mover el uso a `@real/auth-client` o, si es
      legítimo, declarar `firebase` y documentar el motivo.
- [ ] `@real/auth-server` y `@real/ui`: sacar los frameworks de `dependencies` (R3).
- [ ] Limpiar el catalog muerto (15 entradas) y los `@radix-ui/*` redundantes en los fronts.

### F1 — Visibilidad (1 sprint, nada bloquea)

- [ ] CI: paso `deps:check` con los grep de R1 + `knip --dependencies` en modo reporte
- [ ] Renovate activado con el `renovate.json` de R5
- [ ] OSV-Scanner en CI en modo reporte
- [ ] Template de PR con el checklist de R4

### F2 — Enforcement

- [ ] Reglas de "Dependencias (post ADR-018)" en `03-reglas-duras.md` bloquean en CI
- [ ] `shamefully-hoist=false` + `public-hoist-pattern` mínimo, documentado en Excepciones
- [ ] `minimumReleaseAge` + `onlyBuiltDependencies`, validados en un deploy de Railway
- [ ] `--frozen-lockfile` verificado en el Dockerfile / nixpacks de cada servicio

### F3 — Un núcleo, tres repos

- [ ] Alinear Node, TypeScript, NestJS, Prisma, React y Next entre welver,
      ecosistema-ms y grupojl-control
- [ ] ADR aparte: mecanismo de sincronización del núcleo (preset compartido de
      Renovate vs catalog publicado como paquete)
