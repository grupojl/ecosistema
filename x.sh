#!/usr/bin/env bash
# adr-018-ecosistema.sh — ADR-018 · Política de dependencias para ecosistema (welver)
#
# Qué hace (solo toca .claude/):
#   · crea   .claude/decisions/ADR-018-politica-dependencias.md
#   · crea   .claude/architecture/11-dependencias-norte.md
#   · anexa  sección "Dependencias (post ADR-018)" a .claude/architecture/03-reglas-duras.md
#   · anexa  sección "Dependencias — política única (ADR-018)" a .claude/CLAUDE.md
#
# Uso (desde la raíz de welver, o pasando la ruta):
#   bash adr-018-ecosistema.sh [ruta-repo] [--dry-run] [--force]
#
#   --dry-run   muestra qué haría sin escribir nada
#   --force     sobrescribe ADR y norte si ya existen (las secciones anexadas nunca se duplican)
#
# Idempotente: ejecutarlo dos veces no duplica contenido. No usa Python.
# Requiere: bash, grep, sed, cmp, mktemp, tail (incluidos en Git Bash para Windows).

set -euo pipefail

REPO_LABEL="ecosistema (welver)"
REPO_MARKER="realsass-sass-back"   # entrada esperada en pnpm-workspace.yaml (evita correr el script en el repo equivocado)

emit_adr() {
cat <<'__ADR018_EOF__'
# ADR-018: Política de dependencias — una versión, declarada donde se usa, con dueño

**Fecha:** 2026-09-22
**Estado:** Propuesto
**Alcance:** Transversal — mismo número en welver, ecosistema-ms y grupojl-control
**Complementa:** ADR-002-catalog-unico (el catalog único pasa a ser la única fuente de versiones)
**Guía operativa:** `architecture/11-dependencias-norte.md`

## Contexto

Auditoría del 2026-09-22 sobre los 10 workspaces de welver (`package.json` resueltos
contra el catalog + imports reales de `src/`):

- **Build roto latente:** `realsass-ecommerce-back` importa `@nestjs-modules/ioredis`
  (`src/markets/market-resolver.service.ts`) y ningún workspace lo declara.
- **Phantom deps enmascaradas por `shamefully-hoist=true`:** `express` (tipos) en ambos
  backs; `firebase` en `realsass-dashboard-front`, que llega vía `@real/auth-client`.
- **Versiones fuera del catalog:** 6 paquetes `@opentelemetry/*` en `realsass-sass-back`
  fijados en 0.54 / 1.27 mientras el catalog tiene 0.57 / 0.58 → dos copias de
  `@opentelemetry/api` conviviendo, con trazas que se pierden sin error. También `@types/qs`
  y, en `realsass-sass-front`, `next-themes`, `postcss` (`^8.5`) y `tw-animate-css`
  (`1.3.3` pineado).
- **Riesgo de doppelgangers:** `@real/auth-server` declara `@nestjs/common` y
  `firebase-admin` en `dependencies` **y** en `peerDependencies`; `@real/ui` hace lo
  mismo con `react`.
- **Duplicación:** los 3 fronts redeclaran los paquetes `@radix-ui/*` que ya viven en
  `@real/ui`.
- **Catalog muerto:** 15 entradas sin consumidor (`bull`, `@nestjs/bull`, `bcrypt`,
  `@nestjs/jwt`, `class-validator`, `resend`, `@testing-library/*`, `@playwright/test`,
  entre otras).
- **Deriva entre repos:** Prisma 7.4 aquí, 7.8 en ecosistema-ms y 6.x en grupojl-control.

El patrón común es la ausencia de una política explícita y de verificación automática:
cada PR decide por su cuenta y `shamefully-hoist` esconde el resultado.

## Decisión

Adoptamos una política única de dependencias para los tres monorepos, definida en
`architecture/11-dependencias-norte.md`:

1. **Una sola versión:** el `catalog:` es la única fuente de versiones (R1).
2. **Declarado donde se usa:** cero phantom deps; objetivo `shamefully-hoist=false` (R2).
3. **Libs internas con peers:** frameworks nunca en `dependencies` de `packages/*` (R3).
4. **Toda dependencia nueva pasa un checklist y tiene dueño** (R4).
5. **Upgrades continuos** con Renovate agrupado y semanal (R5).
6. **Cadena de suministro verificada:** lockfile congelado, `minimumReleaseAge`,
   OSV-Scanner (R6).

Adopción progresiva: **F0** bloqueantes → **F1** reporte sin bloquear → **F2** enforcement
en CI → **F3** alineación del núcleo entre repos.

## Alternativas descartadas

- **Mantener el status quo con `shamefully-hoist=true`** — enmascara phantom deps que
  explotan al cambiar de builder, al usar `pnpm deploy` o al borrar una dependencia en
  otro workspace. El costo aparece en producción, no en el PR.
- **Modelo Google literal (vendoring de `third_party/` + Bazel)** — resuelve todo, pero
  exige infraestructura y un equipo de build desproporcionados para nuestra escala.
- **Una política distinta por repo** — es exactamente lo que produjo la deriva actual
  (Prisma 6 / 7.4 / 7.8 entre los tres repos).
- **Pinning exacto de todo, sin `^`** — la reproducibilidad ya la da el lockfile; pinear
  sin un bot de upgrades congela también los parches de seguridad.
- **Dependabot en lugar de Renovate** — menos control sobre agrupamiento y aprobación
  de majors. Se reevalúa si cambia.

## Consecuencias

**Se gana:** builds reproducibles; errores de dependencias detectados en el PR y no en
Railway; upgrades chicos y frecuentes en vez de migraciones grandes; superficie de ataque
conocida y con dueño.

**Se sacrifica:** agregar una dependencia deja de ser un `pnpm add` de 5 segundos (requiere
checklist y aprobación); F0 y F2 consumen tiempo de sprint; `shamefully-hoist=false` puede
exigir `public-hoist-pattern` para tooling (Next, Nest CLI, Jest) — cada excepción se
documenta en el norte.

**Deuda consciente:** la alineación del núcleo entre repos (F3) y el mecanismo para
sincronizarlo quedan para un ADR aparte.

## Referencias

- `architecture/11-dependencias-norte.md` — reglas R1–R6, métricas, excepciones y plan
- `architecture/03-reglas-duras.md` — sección "Dependencias (post ADR-018)"
- `pnpm-workspace.yaml`, `.npmrc`, `*/package.json`, `packages/*/package.json`
- Titus Winters et al., *Software Engineering at Google*, cap. 21 "Dependency Management"
- Documentación de Rush: "Phantom dependencies" y "NPM doppelgangers"
- OpenSSF Scorecard · SLSA · OSV-Scanner
__ADR018_EOF__
}

emit_norte() {
cat <<'__ADR018_EOF__'
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
__ADR018_EOF__
}

emit_reglas() {
cat <<'__ADR018_EOF__'

<!-- ADR-018 -->
---

## Dependencias (post ADR-018)

Detalle, excepciones y estado actual en `architecture/11-dependencias-norte.md`.

### 🔴 Cero versiones fuera del catalog
Todo `package.json` usa `catalog:` o `workspace:*`. Única excepción automática: rangos en
`peerDependencies` de `packages/*`. Cualquier otra se registra en el norte.
```bash
grep -rnE '^\s*"[^"]+":\s*"(\^|~|[0-9])' --include=package.json . \
  --exclude-dir=node_modules | grep -vE '"version"'
# → 0 resultados salvo excepciones registradas
```
→ Enforcement objetivo: paso `deps:check` en CI
→ Estado: manual — ver baseline en el norte

### 🔴 Todo import externo está declarado en su workspace
"Funciona porque otro workspace lo trae" es un bug latente, no una excepción.
Incluye tipos (`@types/express`) e imports dinámicos (`await import('pkg')`).
```bash
pnpm dlx knip --dependencies   # → 0 unlisted, 0 unused
```
→ Enforcement objetivo: `knip` en CI + `shamefully-hoist=false` (F2)
→ Estado: manual

### 🔴 Nombres de paquete válidos y catalog resoluble
Una clave como `"/nestjs-prometheus"` o un `catalog:` sin entrada rompe el install del
workspace completo — y con él el build de todos los servicios en Railway.
```bash
grep -rnE '^\s*"[/-][^"]*":' --include=package.json . --exclude-dir=node_modules  # → 0
pnpm install --frozen-lockfile                                                     # → pasa
```
→ Enforcement objetivo: `pnpm install --frozen-lockfile` como primer paso del CI
→ Estado: manual

### 🟡 Libs de packages/* sin frameworks en dependencies
`react`, `react-dom`, `@nestjs/*`, `firebase-admin`, `@prisma/client` →
`peerDependencies` + `devDependencies`.
→ Enforcement: code review de todo PR que toque `packages/*/package.json`
→ Estado: manual

### 🟡 Dependencia nueva con checklist R4 en el PR
Sin checklist (licencia, Scorecard, mantenimiento, dueño) → se mergea solo con ticket de deuda.
→ Enforcement objetivo: template de PR (F1)
→ Estado: manual

### 🟡 @types/* y tooling solo en devDependencies
Un `@types/*` en `dependencies` termina en la imagen de producción.
→ Enforcement: code review
→ Estado: manual
__ADR018_EOF__
}

emit_claude() {
cat <<'__ADR018_EOF__'

<!-- ADR-018 -->
---

## Dependencias — política única (ADR-018)

### El norte

**Google** (una versión, dueño, strict deps) · **Microsoft Rush** (cero phantom deps) ·
**OpenSSF / SLSA** (cadena de suministro)

*Toda dependencia es código ajeno que corre con nuestros permisos: entra con dueño,
con una sola versión y declarada donde se usa.*

### Reglas no negociables

```
Versión    solo catalog: o workspace:*  — nada hardcodeado
Declarar   todo import externo está en el package.json del workspace que lo usa
Libs       packages/* → frameworks en peerDependencies, nunca en dependencies
Nueva dep  checklist R4 del norte en el PR + dueño asignado
Lockfile   --frozen-lockfile en CI y en Railway
```

Ver `architecture/11-dependencias-norte.md` y `decisions/ADR-018-politica-dependencias.md`.
__ADR018_EOF__
}

# ── Utilidades ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_OK=''; C_WARN=''; C_ERR=''; C_DIM=''; C_RST=''
fi
log()  { printf '%s\n' "  $*"; }
ok()   { printf '%s\n' "${C_OK}  ✔ $*${C_RST}"; }
warn() { printf '%s\n' "${C_WARN}  ⚠ $*${C_RST}"; }
die()  { printf '%s\n' "${C_ERR}  ✖ $*${C_RST}" >&2; exit 1; }
# GNU grep no detecta un CR aislado de forma fiable → se cuenta con tr
has_crlf() { [ -n "$(tr -cd '\r' < "$1" | head -c1)" ]; }
usage() { sed -n '2,/^$/{s/^# \{0,1\}//;p}' "$0"; }

# ── Argumentos ────────────────────────────────────────────────────────────────
DRY_RUN=0
FORCE=0
REPO_DIR="."
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --force)   FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    -*)        die "Opción desconocida: $1 (usá --help)" ;;
    *)         REPO_DIR="$1" ;;
  esac
  shift
done
cd "$REPO_DIR" 2>/dev/null || die "No existe el directorio: $REPO_DIR"

ADR_FILE=".claude/decisions/ADR-018-politica-dependencias.md"
NORTE_FILE=".claude/architecture/11-dependencias-norte.md"
REGLAS_FILE=".claude/architecture/03-reglas-duras.md"
CLAUDE_FILE=".claude/CLAUDE.md"
MARKER="<!-- ADR-018 -->"

CHANGED=()
SKIPPED=0
IN_GIT=0
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Preflight: repo correcto, numeración libre, estado de git ────────────────
preflight() {
  [ -f pnpm-workspace.yaml ] \
    || die "No hay pnpm-workspace.yaml en $(pwd). Ejecutá el script desde la raíz de $REPO_LABEL."
  grep -q "$REPO_MARKER" pnpm-workspace.yaml \
    || die "Este no parece ser $REPO_LABEL: pnpm-workspace.yaml no contiene \"$REPO_MARKER\". ¿Script equivocado?"
  [ -d .claude/decisions ]    || die "Falta .claude/decisions/"
  [ -d .claude/architecture ] || die "Falta .claude/architecture/"

  local f
  for f in .claude/decisions/ADR-018-*.md; do
    [ -e "$f" ] || continue
    [ "$f" = "$ADR_FILE" ] || die "El número ADR-018 ya está ocupado por $f. Renumerá antes de continuar."
  done
  for f in .claude/architecture/11-*.md; do
    [ -e "$f" ] || continue
    [ "$f" = "$NORTE_FILE" ] || warn "Ya existe $f con prefijo 11 — el norte se crea igual; revisá la numeración."
  done

  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    IN_GIT=1
    if ! git diff --quiet -- .claude 2>/dev/null; then
      warn "Hay cambios sin commitear en .claude/: el diff final los va a mezclar con estos."
    fi
  else
    warn "No es un repositorio git: no vas a poder revertir con git restore."
  fi
}

# ── Crear archivo nuevo (idempotente) ────────────────────────────────────────
write_new() {  # $1 destino · $2 archivo temporal con el contenido
  local dest="$1" src="$2"
  if [ -e "$dest" ] && cmp -s "$src" "$dest"; then
    ok "$dest ya está al día"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi
  if [ -e "$dest" ] && [ "$FORCE" -ne 1 ]; then
    warn "$dest ya existe y difiere — no se toca (usá --force para sobrescribir)"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    log "${C_DIM}[dry-run] escribiría $dest ($(wc -l < "$src" | tr -d ' ') líneas)${C_RST}"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  ok "escrito $dest"
  CHANGED+=("$dest")
}

# ── Anexar sección una sola vez, respetando CRLF/LF del destino ─────────────
append_once() {  # $1 destino · $2 archivo temporal con el bloque
  local dest="$1" src="$2" block="$TMP_DIR/append.block" eol=$'\n'
  if [ ! -f "$dest" ]; then
    warn "$dest no existe — se omite"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi
  if grep -qF "$MARKER" "$dest"; then
    ok "$dest ya contiene la sección ADR-018"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi
  if has_crlf "$dest"; then
    eol=$'\r\n'
    sed 's/$/\r/' "$src" > "$block"
  else
    cp "$src" "$block"
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    log "${C_DIM}[dry-run] anexaría $(wc -l < "$src" | tr -d ' ') líneas al final de $dest${C_RST}"
    return 0
  fi
  # el archivo puede no terminar en salto de línea
  if [ -s "$dest" ] && [ -n "$(tail -c1 "$dest")" ]; then
    printf '%s' "$eol" >> "$dest"
  fi
  cat "$block" >> "$dest"
  ok "anexada sección ADR-018 en $dest"
  CHANGED+=("$dest")
}

# ── Verificación posterior ───────────────────────────────────────────────────
verify() {
  if [ "$DRY_RUN" -eq 1 ]; then return 0; fi
  local f n
  for f in "$ADR_FILE" "$NORTE_FILE"; do
    [ -s "$f" ] || die "Verificación: $f vacío o inexistente"
  done
  for f in "$REGLAS_FILE" "$CLAUDE_FILE"; do
    [ -f "$f" ] || continue
    n="$(grep -cF "$MARKER" "$f" || true)"
    [ "$n" -le 1 ] || die "Verificación: $f tiene $n marcadores ADR-018 (se esperaba 1)"
  done
  ok "verificación OK"
}

summary() {
  echo
  log "Resumen $REPO_LABEL: ${#CHANGED[@]} archivo(s) escrito(s), $SKIPPED sin cambios."
  if [ "${#CHANGED[@]}" -gt 0 ] && [ "$IN_GIT" -eq 1 ]; then
    log "Revisar:  git diff -- .claude && git status --short .claude"
    log "Commit:   git add ${CHANGED[*]} \\"
    log "            && git commit -m \"docs(.claude): ADR-018 política de dependencias\""
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    log "Modo --dry-run: no se escribió nada."
  fi
}

main() {
  echo "ADR-018 · política de dependencias → $REPO_LABEL ($(pwd))"
  preflight
  emit_adr    > "$TMP_DIR/adr.md"
  emit_norte  > "$TMP_DIR/norte.md"
  emit_reglas > "$TMP_DIR/reglas.md"
  emit_claude > "$TMP_DIR/claude.md"
  write_new   "$ADR_FILE"    "$TMP_DIR/adr.md"
  write_new   "$NORTE_FILE"  "$TMP_DIR/norte.md"
  append_once "$REGLAS_FILE" "$TMP_DIR/reglas.md"
  append_once "$CLAUDE_FILE" "$TMP_DIR/claude.md"
  verify
  summary
}

main