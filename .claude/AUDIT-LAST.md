# AUDIT-LAST.md — Auditoría de welver/

**Fecha:** 2026-09-09
**Generado por:** `./x.sh docs` — mediciones sobre el árbol de trabajo
**Protocolo:** `.claude/AUDIT.md`

> Este archivo **no se escribe a mano**. Cada score sale de un conteo sobre el
> repo, con la rúbrica aplicada en `compute_scores()` dentro de `x.sh`.
> Para regenerarlo: `./x.sh docs`. Para ver los checks sin escribir: `./x.sh status`.
>
> Lo que un ADR declara implementado **no cuenta como evidencia**. Sólo el conteo.

---

## Scores por dimensión

| # | Dimensión | Score | Peso | Pond. | Medición |
|---|---|---|---|---|---|
| 1 | TypeScript Strict | 1.0/10 | 15% | 0.15 | `noImplicitAny:false` en algún back: 1 · `any` sin justificar: 34 (de 34 totales, 0 con `@real/jsonb-cast`) · archivos con class-validator: 1 |
| 2 | Arquitectura de capas | 5.5/10 | 20% | 1.10 | sass-back 11/13 módulos con `domain/`+`repository/` · ecommerce-back 1/7 · services con `PrismaService` inyectado: 9 · `AnyRouter`/`any` en packages/trpc: 0 |
| 3 | Frontend — Fetch y estado | 5.5/10 | 15% | 0.82 | archivos con `HydrationBoundary`: 0 (sobre 9 `page.tsx` en storefront) · `fetch()` crudo en hooks: 1 · import `@real/trpc`: ❌ roto — TS2305 |
| 4 | Seguridad | 8.9/10 | 15% | 1.33 | helmet 2/2 · `@Throttle` en auth: 1 · `migrate deploy` 2/2 · CORS wildcard: 0 · `.dockerignore` 3/5 · `$queryRaw`: 2 ⚠️ auditar interpolación · `pnpm audit` en CI: 0 |
| 5 | Configuración y entorno | 7.3/10 | 10% | 0.73 | `.env.example` backs 2/2 (fronts 1/3, informativo) · fail-fast en main.ts 2/2 · `packageManager`: 0 · named catalogs: 0 · conflicto nixpacks/railway: 2 · `railway.json` 4/5 · versiones de pnpm distintas: 2 |
| 6 | CI/CD y tests | 5.9/10 | 10% | 0.59 | workflows: 7 (con typecheck 7, con path filters 7, que corren tests 0) · tests backend 14 · frontend 0 · e2e 2 · unidades testeables 45 · `coverageThreshold`: 0 |
| 7 | Deuda técnica | 4.6/10 | 15% | 0.69 | módulos sin D+R: 8 · imports legacy: 0 · archivos con observabilidad: 0 · TODO/FIXME/HACK: 0 · `.bak-*` sin limpiar: 0 |

## Score global: **5.42/10**

Anterior: 9.01 · Delta: -3.59

---

## Cómo leer un delta

Un delta negativo puede significar dos cosas distintas y conviene no confundirlas:

1. **Regresión real** — entró código que empeoró una dimensión.
2. **Corrección de medición** — antes se puntuaba sobre lo declarado en un ADR y
   ahora se cuenta sobre archivos. El 9.01 del 2026-09-08 convivía con
   `noImplicitAny:false` en el tsconfig de ecommerce-back: ese score medía intención.

Desde que este archivo lo genera `x.sh`, los deltas sólo pueden ser del tipo 1.

---

## Gaps abiertos, ordenados por impacto en el global

### `noImplicitAny: false` en ecommerce-back
`realsass-ecommerce-back/tsconfig.json` extiende `tsconfig.base.json` (strict:true)
y después lo desarma. Mientras esté, ningún `any` implícito de ese servicio falla
el typecheck — el score de D1 mide un techo, no el piso real.
**Cerralo primero:** define cuánto trabajo hay debajo. `./x.sh ecommerce-back`
**Riesgo:** puede destapar decenas de errores. Correr typecheck antes de commitear.
### Import roto de `@real/trpc`
`realsass-sass-front/lib/config-client.ts` importa `AppRouter`; el paquete sólo
exporta `SassAppRouter` y `EcommerceAppRouter`. Es TS2305 — ese front no compila.
`./x.sh packages && ./x.sh sass-front`
### HydrationBoundary en cero
Ningún archivo del storefront usa `dehydrate` + `<HydrationBoundary>`. Los Server
Components hacen prefetch y el cliente vuelve a pedir: loading flash en SSR real.
No lo aplica `x.sh` — requiere `prefetchQuery` página por página. Task E11-02.
### 8 módulos sin Domain/Repository
Los services van directo a Prisma. Marcado como decisión consciente en E1-12..E1-15;
sigue siendo defendible hasta que entre pagos-back.
### Observabilidad en cero
0 archivos con `opentelemetry`, `prom-client` o `correlationId`. Escalón 6 completo
sin empezar. Sin `correlationId` propagado, un incidente que cruza los dos backs
no se puede reconstruir.
### 2 usos de `\$queryRaw`/`\$executeRaw`
No verificable por conteo: hay que leer cada uno y confirmar que no interpola
input del usuario. Task E7-03.

---

## Lo que este script **no** puede medir

| Ítem | Por qué | Cómo cerrarlo |
|---|---|---|
| `organizationId` en cada `where` | requiere análisis semántico, no grep | test cross-tenant (E8-05) |
| N+1 / `include` explícito | idem | `EXPLAIN ANALYZE` (E11-04) |
| Interpolación en `$queryRaw` | grep detecta el uso, no el riesgo | revisión manual de los 2 usos |
| Calidad de los tests existentes | cuenta archivos, no asserts | `coverageThreshold` en jest.config |
| Prefijo `organizationId` en claves Redis | depende del cuerpo de cada llamada | E10-01 |

La única forma de cerrar la primera fila es un test, no una auditoría. Sigue siendo
el trabajo de mayor valor pendiente: un `findMany` sin `organizationId` es fuga de
datos entre organizaciones y hoy nada lo detecta.
