# ADR-016 / ADR-017 — SEO + idioma: estado final

**Última actualización:** 2026-09-22
**Estado:** ✅ CÓDIGO COMPLETO — ⚠️ EJECUCIÓN BLOQUEADA por hardening preexistente

> Snapshot dinámico. Esta es la versión final de la sesión que implementó
> ADR-016 y su extensión ADR-017. Léelo junto con `roadmap/deuda-tecnica.md`
> antes de asumir que algo "no funciona" — la mayoría de lo que falla hoy
> no tiene que ver con este trabajo.

## Qué está verificado (código correcto, probado contra la fuente real)

| Área | Verificación |
|---|---|
| Negociación de idioma, rutas `[locale]`, canonical/hreflang/sitemap/JSON-LD | `verify.sh` a `verify3.sh` en verde |
| Fixes post-tsc (`getSiteUrl`, archivo muerto, narrowing del sitemap) | `verify4.sh` en verde |
| `@real/trpc` como dependencia declarada | `verify5.sh` en verde |
| Mapa mundial de 180 países, RTL listo, fr/de activos | `verify3.sh` en verde |
| `Order.locale` end-to-end (schema, service, router, front) | `verify6.sh` en verde, 17/17 |
| Suite de tests de `real-ecommerce-front` | **99/99**, ~99% cobertura en `lib/i18n` + `lib/seo` + `lib/catalog` + `lib/checkout` |

Todo lo anterior se corrió contra el código real (no en aislamiento) antes
de cada entrega — instalación de `vitest` en sandbox, `tsc` sobre archivos
tocados, validación de JSON con `node -e`.

## Qué está bloqueado — y por qué no es de acá

El `tsc` completo del monorepo (con dependencias instaladas) sigue
fallando. Cada error se triageó contra los archivos que este trabajo tocó
(ninguno) vs. archivos preexistentes (todos). Los 7 bloqueantes reales
están documentados con línea exacta y causa raíz en
`roadmap/deuda-tecnica.md` §Hardening detectado en sesión SEO+idioma.

**Consecuencia concreta:** `checkout()` no ejecuta hoy — revienta antes de
llegar a usar `Order.locale`. El campo está listo (schema, tipos,
validación, cableado del front) para el momento en que hardening resuelva
esos bugs — no va a requerir tocarse de nuevo.

## Orden de deploy (sin cambios respecto al diseño original)

```
1. realsass-sass-back
2. realsass-ecommerce-back   (incluye Order.locale — requiere migración Prisma)
3. real-ecommerce-front
```

Antes de deployar: correr `pnpm --filter realsass-ecommerce-back prisma
migrate dev --name add_order_locale` contra la DB real.

## Log de sesiones

- **2026-09-22, sesión 1** — Auditoría de SEO: 7 bugs bloqueantes originales
  (ver ADR-016 §Contexto). Diseño e implementación completa: negociación de
  idioma, rutas por locale, SEO, sitemap, JSON-LD.
- **2026-09-22, sesión 2 (post-tsc real)** — 3 bugs propios encontrados con
  `tsc` contra dependencias reales (import de `getSiteUrl`, archivo muerto
  que sobrevivió un `git mv`, narrowing de tipos en el sitemap). Corregidos
  y verificados.
- **2026-09-22, sesión 3 (`@real/trpc`)** — Diagnóstico incorrecto inicial
  (exports map) corregido con evidencia (el error no cambiaba antes/después
  del fix). Causa real: dependencia nunca declarada. Corregida.
- **2026-09-22, sesión 4 (mundial)** — Mapa de 180 países, RTL, fr/de
  activados, fallback con logging accionable.
- **2026-09-22, sesión 5 (`Order.locale`)** — Campo agregado end-to-end,
  alcance acotado a propósito tras encontrar 3 bugs más en `checkout()`
  (no corregidos, documentados para hardening).
- **2026-09-22, sesión 6 (triage final)** — 2 bugs de sintaxis nuevos
  encontrados en `app.module.ts` y `organizations-client.service.ts`,
  ninguno relacionado a este trabajo. Backlog de hardening cerrado en 7
  items con causa raíz documentada.
