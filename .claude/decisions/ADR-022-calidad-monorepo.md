# ADR-022: Calidad del monorepo — las reglas se verifican solas

**Fecha:** 2026-10-14
**Estado:** Aceptado
**Alcance:** Transversal — los 10 workspaces de welver
**Complementa:** ADR-018 (dependencias), ADR-019 (contratos tRPC), ADR-005 (todo interno por tRPC)

## Contexto

La auditoría del 2026-10-14 mostró que las reglas del proyecto estaban bien escritas pero no se
cumplían de forma verificable:

- `CLAUDE.md` decía "TypeScript strict", pero los dos backs tenían `noImplicitAny: false`.
- El `eslint.config.mjs` de los fronts prometía `no-bare-fetch` en su cabecera y no lo implementaba.
- El `lint` de los backs corría con `--fix` (en CI mutaba el código en vez de fallar), exigía Prettier
  sobre un código con estilo alineado a mano (~34.000 errores de formato) y lintaba `src/generated`.
- El `typecheck` de `@real/auth-server` era un `echo` (y su tsconfig no compilaba con TypeScript 6): un error de tipos ahí pasaba el CI.
- 15 workflows de GitHub solapados (`ci-*.yml` y `<servicio>.yml`), distintos Node (22 / 24), sin `lint`
  en la mitad y sin `audit` en la otra.
- 24 vulnerabilidades en `pnpm audit` (3 críticas) y `overrides` acumulados sin dueño.
- 33 archivos de respaldo (`*.bak`, `*PATCH.md`) versionados y scripts de auditoría sueltos en la raíz.
- Dependencias fantasma que solo funcionaban por `shamefully-hoist=true` (`class-validator` /
  `class-transformer` para el `ValidationPipe`, `eslint` en 3 fronts, `firebase`, `express`, `zod`).

## Decisión

**Una regla que no falla en CI no es una regla.** Cada principio tiene un chequeo automático.

```
TypeScript  strict + noUncheckedIndexedAccess en backs y @real/auth-server; module/moduleResolution node16 sin
            baseUrl ni ignoreDeprecations. Único relajado: strictPropertyInitialization en los backs (props que inyecta Nest)
Validación  Zod es la ÚNICA librería (tRPC input() y ZodValidationPipe). Sin class-validator, class-transformer ni joi
Tests       jest (backs, @real/auth-server) y vitest (storefront). Una sola config por workspace. Cobertura con umbral que
            SOLO sube (jest.config.js); el CI falla si baja. Specs al lado del archivo (scripts/audit/testing.sh)
Lint        sin `any`, sin variables sin uso (prefijo _ para ignorar), no-floating-promises.
            `lint` NUNCA modifica código; `lint:fix` aparte. El formato es de Prettier, no de ESLint
Fetch       prohibido en los fronts salvo FETCH_ALLOWLIST (eslint.config.mjs de cada front).
            Sumar una excepción exige justificarla en el PR
Typecheck   `tsc --noEmit` real en todos los paquetes (nunca un echo)
CI          un solo pipeline: .github/workflows/ci.yml con 4 jobs — quality (contracts → lint → typecheck → build),
            tests (cobertura), dependencies (pnpm audit --audit-level=high) y audits (scripts/audit) — más
            secrets.yml (gitleaks) y Dependabot. Todos bloqueantes
Overrides   una regla por paquete y major, con fecha de revisión; se borra al subir el padre
Dependencias  todo import externo declarado en su workspace: `scripts/audit/phantom-deps.cjs`
Repo        sin *.bak ni *PATCH.md (git es el backup). Auditorías en scripts/audit/. .env.make es local
            (plantilla: .env.make.example). Pre-commit contra secretos: `pnpm setup:hooks`
Entorno     Node en .nvmrc, pnpm en "packageManager"
```

## Verificación local

```
pnpm check          # contracts + lint + typecheck + tests con cobertura + build (lo mismo que corre el CI)
pnpm test:ci        # solo tests (backs + auth-server + storefront + hooks)
pnpm audit:deps     # vulnerabilidades high/critical
make a              # auditorías de arquitectura / contratos / seguridad / testing / dependencias / deploy
pnpm setup:hooks    # una vez por clon: activa .githooks/pre-commit (frena secretos y archivos basura)
```

## Excepciones documentadas (deuda consciente)

Cerradas el 2026-10-14: **A1** (Prisma directo en `auth.service`, `webhook-delivery.service` e
`internal-organizations.service`: ahora van por repositorio) y **A3** (`firebase-admin` directo en sass-back:
ahora `getFirebaseAdmin()` de `@real/auth-server`). Las auditorías los exigen en 0.

Lo único que queda como excepción es `FETCH_ALLOWLIST` (`eslint.config.mjs` de cada front), y toda entrada es
legítima por diseño:
- wrappers del link de tRPC (`lib/trpc/**`), que existen para inyectar `credentials: 'include'`;
- clientes de servicios que NO son parte del monorepo (`dashboard-front/lib/external-client.ts` → campañas y pagos;
  `lib/chat-ia-client.ts` y la página de prueba del chat-ia);
- bootstrap de la cookie de sesión (`POST/DELETE /auth/session`, ADR-004), único `fetch` que queda en `auth-context`.

Estas excepciones están listadas en el propio script / config que las tolera; no hay forma de sumar
una sin tocar un archivo versionado y revisable.

## Consecuencias

- Un PR que rompe tipos, lint, build, introduce una dependencia fantasma o una vulnerabilidad alta no se mergea.
- El hoisting global se apagó (`shamefully-hoist` fuera de `.npmrc` y de los 5 Dockerfiles): el monorepo compila sin él,
  los 2 backs arrancan (`node dist/main.js`) y los 4 fronts sirven desde `.next/standalone`.
  **Sin validar con `docker build` real** (no había Docker disponible): validarlo antes de mergear a la rama de deploy.
- La validación se verificó en un **clon limpio** (copia del árbol sin `node_modules`, `--frozen-lockfile`): un
  `node_modules` viejo con paquetes "hoisteados" había tapado dependencias fantasma (`@types/pg`,
  `@prisma/client-runtime-utils`) y un `typeRoots` roto. Antes de dar algo por bueno, reinstalar desde cero.
- Los tests son parte del contrato: ver las reglas de **Tests** arriba y `scripts/audit/testing.sh`.
