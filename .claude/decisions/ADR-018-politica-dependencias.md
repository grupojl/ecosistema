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
