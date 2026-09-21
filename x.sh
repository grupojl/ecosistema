#!/usr/bin/env bash
# =============================================================================
# x.sh — Instalar .claude/architecture/10-monorepo-estructura.md
# Auto-detecta el monorepo, ajusta el contenido específico de cada uno
# =============================================================================

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${CYAN}[monorepo-arch]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }

# Auto-detect
REPO_MODE=""
if [[ -f "pnpm-workspace.yaml" ]] && [[ -d "realsass-sass-back" ]]; then
  REPO_MODE="welver"
elif [[ -d "chatia-backend" ]]; then
  REPO_MODE="ecosistema-ms"
elif [[ -d "grupojl-control-backend" ]]; then
  REPO_MODE="superadmin"
fi

[[ -n "$REPO_MODE" ]] || { echo "No se detectó monorepo"; exit 0; }
log "Modo: $REPO_MODE"

mkdir -p .claude/architecture

# =============================================================================
# Contenido base común a los 3 monorepos
# =============================================================================
write_common_header() {
  local TURBO_NOTE="$1"
  cat << MD
# 10 — Estructura de monorepo: hacia 10/10

> Referentes: **Vercel (Turborepo)** · **Nx/Nrwl** · **Google (Bazel)**
>
> Norte: dado cualquier cambio en el repo, el sistema sabe exactamente qué
> buildear, qué testear y qué deployar — sin buildear nada de más.

---

## Por qué este monorepo ya tiene buena estructura

Los 3 monorepos de GrupoJL tienen workspace organization correcta y
dependency graph bien modelado. El gap con el 10/10 es de **orquestación
y enforcement** — no de estructura.

$TURBO_NOTE

---

## Nivel 1 — Bloqueante (hacer antes del próximo deploy)

### 1.1 Regenerar lockfile tras deps nuevas

Cada vez que se agrega una dep al catalog, el lockfile queda desincronizado.
CI falla en el primer \`pnpm install --frozen-lockfile\`.

\`\`\`bash
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: regenerar lockfile"
\`\`\`

**Regla permanente:** toda sesión que agrega deps termina con \`pnpm install\`
y el lockfile commiteado. Sin excepción.

### 1.2 Branch protection en GitHub

Sin esto los CI existen pero no bloquean merge.
Settings → Branches → Add rule → main → Required status checks:

MD
}

# =============================================================================
# WELVER
# =============================================================================
write_welver() {
  TARGET=".claude/architecture/10-monorepo-estructura.md"

  write_common_header "**welver** tiene 7 packages: 2 backs + 3 fronts + 2 packages compartidos.
Turborepo agrega el 20% que falta: task graph declarado + caché de builds." > "$TARGET"

  cat >> "$TARGET" << 'MD'
| Check requerido | Workflow |
|----------------|----------|
| ci-sass-back | typecheck + test + build |
| ci-ecommerce-back | typecheck + test + build |
| ci-packages | typecheck + build de @real/* |

---

## Nivel 2 — Turborepo (próximo sprint)

### 2.1 Instalar Turborepo

```bash
pnpm add turbo --save-dev -w
```

### 2.2 `turbo.json` en la raíz

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**`dependsOn: ["^build"]`** es la clave: cuando cambia `@real/trpc`,
Turborepo sabe que rebuildea sass-back y ecommerce-back antes de sus tests,
en el orden correcto y en paralelo donde sea posible.

### 2.3 Reemplazar scripts en `package.json` raíz

```json
"scripts": {
  "build":     "turbo build",
  "typecheck": "turbo typecheck",
  "test":      "turbo test",
  "dev":       "turbo dev"
}
```

### 2.4 Caché remota en CI

```yaml
# Agregar en cada CI workflow después de pnpm install
- name: Setup Turborepo cache
  uses: rharkor/caching-for-turbo@v1.8
```

---

## Nivel 3 — dependency-cruiser (enforcement de fronteras)

Hoy "ningún import entre backs" es una regla manual. dependency-cruiser la hace automática.

```bash
pnpm add dependency-cruiser --save-dev -w
```

**`.dependency-cruiser.cjs`:**
```js
module.exports = {
  forbidden: [
    {
      name: 'no-cross-service-back',
      severity: 'error',
      comment: 'sass-back y ecommerce-back no se importan mutuamente',
      from: { path: '^realsass-sass-back/src' },
      to:   { path: '^realsass-ecommerce-back/src' },
    },
    {
      name: 'no-cross-service-back-reverse',
      severity: 'error',
      from: { path: '^realsass-ecommerce-back/src' },
      to:   { path: '^realsass-sass-back/src' },
    },
    {
      name: 'no-prisma-in-service',
      severity: 'warn',
      comment: 'Services usan IRepository. Excepciones: orders.service (checkout $tx), inventory.service (reserveWithinTx)',
      from: { path: '\\.service\\.ts$',
              pathNot: ['orders\\.service', 'inventory\\.service', 'prisma\\.service'] },
      to:   { path: '@prisma/client' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
  },
};
```

**Agregar en `ci-sass-back.yml`:**
```yaml
- name: Check dependency boundaries
  run: pnpm depcruise realsass-sass-back/src --config .dependency-cruiser.cjs
```

---

## Estado actual vs 10/10

| Item | Estado |
|------|--------|
| pnpm workspaces + catalog | ✅ |
| packages/ compartidos (@real/*) | ✅ |
| path filters en CI (5 workflows) | ✅ |
| pnpm store cacheado en CI (config) | ✅ |
| Lockfile actualizado | ⏳ `pnpm install` pendiente |
| Branch protection en GitHub | ❌ Nivel 1.2 |
| Turborepo task graph | ❌ Nivel 2 |
| dependency-cruiser | ❌ Nivel 3 |
| Turbo remote cache | ❌ Nivel 2.4 |

---

## Reglas duras de monorepo

🔴 Nunca mergear con lockfile desactualizado.
🔴 Ningún import entre realsass-sass-back y realsass-ecommerce-back.
🔴 Toda dep nueva va primero al catalog de pnpm-workspace.yaml.
🟡 Versiones de @nestjs/* alineadas con ecosistema-ms.
🟡 pnpm-lock.yaml commiteado siempre — es la fuente de verdad de versiones exactas.
MD

  ok "10-monorepo-estructura.md creado para welver"
}

# =============================================================================
# ECOSISTEMA-MS
# =============================================================================
write_ecosistema_ms() {
  TARGET=".claude/architecture/10-monorepo-estructura.md"

  write_common_header "**ecosistema-ms** tiene la mejor estructura de los 3 monorepos: 5 packages
con roles explícitos (logger, metrics, auth-server, grpc-client, proto) + 6 servicios.
Turborepo + dependency-cruiser completan el 10/10." > "$TARGET"

  cat >> "$TARGET" << 'MD'
| Check requerido | Workflow |
|----------------|----------|
| ci-chatia | typecheck + test + build |
| ci-pasarelapagos | typecheck + test + build |
| ci-packages | typecheck auth-server + grpc-client + build logger + metrics |

---

## Nivel 2 — Turborepo (próximo sprint)

### 2.1 Instalar Turborepo

```bash
pnpm add turbo --save-dev -w
```

### 2.2 `turbo.json` en la raíz

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "start:dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Qué resuelve:** cuando cambia `packages/auth-server`, Turborepo sabe
que tiene que rebuildear los 5 servicios que lo consumen — en paralelo
y solo los afectados.

### 2.3 Reemplazar scripts en `package.json` raíz

```json
"scripts": {
  "build":     "turbo build",
  "typecheck": "turbo typecheck",
  "test":      "turbo test",
  "dev":       "turbo dev"
}
```

### 2.4 Caché remota en CI

```yaml
- name: Setup Turborepo cache
  uses: rharkor/caching-for-turbo@v1.8
```

---

## Nivel 3 — dependency-cruiser (enforcement de fronteras)

La regla "ningún servicio importa de otro servicio" y
"ningún servicio reimplementa Firebase sin @ecosistema-ms/auth-server"
son hoy manuales. dependency-cruiser las automatiza.

```bash
pnpm add dependency-cruiser --save-dev -w
```

**`.dependency-cruiser.cjs`:**
```js
const SERVICES = [
  'chatia-backend',
  'pasarelapagos-backend',
  'notificaciones-backend',
  'analytics-backend',
  'workers-backend',
  'marketing-backend',
];

const crossServiceRules = SERVICES.flatMap(from =>
  SERVICES
    .filter(to => to !== from)
    .map(to => ({
      name: `no-cross-import-${from}-to-${to}`,
      severity: 'error',
      from: { path: `^${from}/src` },
      to:   { path: `^${to}/src` },
    }))
);

module.exports = {
  forbidden: [
    ...crossServiceRules,
    {
      name: 'no-local-firebase-verify',
      severity: 'error',
      comment: 'Usar @ecosistema-ms/auth-server — nunca reimplementar firebase-admin directamente',
      from: { path: '^(chatia|pasarelapagos|notificaciones|analytics|workers)-backend/src',
              pathNot: 'firebase/firebase.module' },
      to:   { path: 'firebase-admin' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
  },
};
```

---

## Estado actual vs 10/10

| Item | Estado |
|------|--------|
| pnpm workspaces + catalog completo | ✅ |
| packages/ con roles explícitos (5 packages) | ✅ |
| Build order correcto (packages → servicios) | ✅ |
| path filters en CI (6 workflows) | ✅ |
| pnpm store cacheado en CI (config) | ✅ |
| Lockfile actualizado | ⏳ `pnpm install` pendiente |
| Branch protection en GitHub | ❌ Nivel 1.2 |
| Turborepo task graph | ❌ Nivel 2 |
| dependency-cruiser (cross-service) | ❌ Nivel 3 |
| Turbo remote cache | ❌ Nivel 2.4 |

---

## Reglas duras de monorepo

🔴 Nunca mergear con lockfile desactualizado.
🔴 Ningún servicio importa de otro servicio — solo de packages/*.
🔴 Ningún servicio reimplementa Firebase directamente — usar @ecosistema-ms/auth-server.
🔴 Toda dep nueva va primero al catalog de pnpm-workspace.yaml.
🟡 Versiones de @nestjs/* alineadas con welver.
🟡 Cuando cambia la firma de un export en packages/auth-server → bump version minor.
MD

  ok "10-monorepo-estructura.md creado para ecosistema-ms"
}

# =============================================================================
# SUPERADMIN
# =============================================================================
write_superadmin() {
  TARGET=".claude/architecture/10-monorepo-estructura.md"

  write_common_header "**superadmin** tiene 2 servicios (backend + frontend) + 1 package de tipos.
Con este tamaño, Turborepo NO se justifica — el overhead supera el beneficio.
Los 2 CI workflows con path filters son suficientes para el 10/10." > "$TARGET"

  cat >> "$TARGET" << 'MD'
| Check requerido | Workflow |
|----------------|----------|
| ci-control-backend | typecheck + test + build |
| ci-control-frontend | typecheck + build |

---

## Nivel 2 — Lo que completa el 10/10 (sin Turborepo)

### 2.1 Caché de pnpm store en CI

Ya está configurado en los workflows con `cache: 'pnpm'` en `setup-node`.
Solo falta el lockfile actualizado (Nivel 1.1) para que la caché sea estable.

### 2.2 dependency-cruiser (opcional — bajo impacto con 2 servicios)

Con solo 2 servicios el cruce de imports es difícil de hacer por accidente.
Agregar solo si el monorepo crece a 4+ servicios.

Si se decide agregar, la regla clave es:
```js
{
  name: 'no-frontend-in-backend',
  severity: 'error',
  from: { path: '^grupojl-control-backend/src' },
  to:   { path: '^grupojl-control-frontend' },
}
```

### 2.3 Typecheck cruzado en CI

Cuando cambia `packages/shared-types`, ambos servicios deben typecheck.
Ya está cubierto por el path filter `packages/**` en ambos workflows.

---

## Estado actual vs 10/10

| Item | Estado |
|------|--------|
| pnpm workspaces | ✅ |
| shared-types como package único | ✅ |
| path filters en CI (2 workflows) | ✅ |
| pnpm store cacheado en CI (config) | ✅ |
| Lockfile actualizado | ⏳ `pnpm install` pendiente |
| Branch protection en GitHub | ❌ Nivel 1.2 |
| Turborepo | ❌ NO aplicar — 2 servicios no lo justifican |
| dependency-cruiser | ❌ Opcional si crece a 4+ servicios |

---

## Reglas duras de monorepo

🔴 Nunca mergear con lockfile desactualizado.
🔴 grupojl-control-backend no importa desde grupojl-control-frontend.
🔴 Toda dep nueva va en grupojl-control-backend/package.json o grupojl-control-frontend/package.json según corresponda. No compartir deps entre los 2 servicios — son independientes en Railway.
🟡 Versiones de @nestjs/* alineadas con welver y ecosistema-ms.
🟡 shared-types: cuando se agrega un tipo nuevo, verificar que ambos servicios lo consumen correctamente antes de mergear.
MD

  ok "10-monorepo-estructura.md creado para superadmin"
}

# =============================================================================
# Dispatch
# =============================================================================
case "$REPO_MODE" in
  welver)        write_welver        ;;
  ecosistema-ms) write_ecosistema_ms ;;
  superadmin)    write_superadmin    ;;
esac

# Git commit
log "Git commit..."
if git rev-parse --git-dir &>/dev/null; then
  git add .claude/architecture/10-monorepo-estructura.md 2>/dev/null || true
  git commit -m "docs(.claude): arquitectura monorepo 10/10 — Turborepo + dependency-cruiser [$REPO_MODE]

- 10-monorepo-estructura.md: gap actual vs referentes mundiales
- Nivel 1: lockfile + branch protection (bloqueante)
- Nivel 2: Turborepo task graph + remote cache (welver + ecosistema-ms)
- Nivel 3: dependency-cruiser enforcement de fronteras
- Reglas duras de monorepo permanentes" \
    && ok "Commit creado" || warn "Sin cambios"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ .claude/architecture/10-monorepo-estructura.md creado [$REPO_MODE]${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"