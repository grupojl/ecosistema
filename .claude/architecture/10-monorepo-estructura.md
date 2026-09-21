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

**welver** tiene 7 packages: 2 backs + 3 fronts + 2 packages compartidos.
Turborepo agrega el 20% que falta: task graph declarado + caché de builds.

---

## Nivel 1 — Bloqueante (hacer antes del próximo deploy)

### 1.1 Regenerar lockfile tras deps nuevas

Cada vez que se agrega una dep al catalog, el lockfile queda desincronizado.
CI falla en el primer `pnpm install --frozen-lockfile`.

```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: regenerar lockfile"
```

**Regla permanente:** toda sesión que agrega deps termina con `pnpm install`
y el lockfile commiteado. Sin excepción.

### 1.2 Branch protection en GitHub

Sin esto los CI existen pero no bloquean merge.
Settings → Branches → Add rule → main → Required status checks:

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
