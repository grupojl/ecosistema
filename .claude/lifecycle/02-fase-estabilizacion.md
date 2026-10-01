# Fase 2 — Estabilización
## Escalones 3, 5, 6 — Antes de producción real

**Estado:** ✅ COMPLETA — cerrada 2026-09-30
**Cuándo:** Completado antes de pasar a Fase 3
**Referentes:** Cloudflare (infra) · Vercel/GitHub (CI/CD) · Datadog (observabilidad)

---

## Escalón 3 — Infraestructura y Red ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| HTTPS | ✅ | TLS automático via Railway |
| CORS explícito | ✅ | `ALLOWED_ORIGINS` sin wildcard en ambos backs |
| Cookies HttpOnly | ✅ | ADR-004 — `__session` HttpOnly + SameSite=Strict |
| Helmet | ✅ | `app.use(helmet())` activo en sass-back y ecommerce-back |
| Rate limiting | ✅ | `ThrottlerModule` + `ThrottlerGuard` como APP_GUARD (30 req/min) |
| Red privada Railway | ✅ | Los backs se comunican via URL privada Railway |
| Puerto 3000 público | ✅ | EXPOSE 3000 + HEALTHCHECK en ambos Dockerfiles |

---

## Escalón 5 — CI/CD y Despliegues ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| Deploy automático Railway | ✅ | Push a main → deploy automático |
| realsass-sass-back.yml | ✅ | typecheck + build + pnpm audit — path filters |
| realsass-ecommerce-back.yml | ✅ | typecheck + build + pnpm audit — path filters |
| realsass-sass-front.yml | ✅ | typecheck + build + pnpm audit — path filters |
| realsass-dashboard-front.yml | ✅ | typecheck + build + pnpm audit — path filters |
| real-ecommerce-front.yml | ✅ | typecheck + build + pnpm audit — path filters |
| packages.yml | ✅ | typecheck auth-server + auth-client + trpc + ui |
| trpc-contract.yml | ✅ | typecheck 3 fronts cuando cambia un router tRPC |
| dependabot.yml | ✅ | npm/pnpm + GitHub Actions — alertas semanales |
| conventions/deploy.md | ✅ | Procedimiento de rollback Railway documentado |
| Branch protection main | ⚠️ | Acción manual en GitHub UI — pendiente confirmar |

---

## Escalón 6 — Observabilidad ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| Health checks | ✅ | `GET /health` con Prisma + Redis en ambos backs |
| Logging JSON (pino) | ✅ | `nestjs-pino` + `LoggerModule` en ambos backs |
| Correlation ID | ✅ | `CorrelationIdMiddleware` registrado en ambos backs |
| Prometheus `/metrics` | ✅ | `PrometheusModule.register()` activo en ambos backs |
| Health check Redis | ✅ | `health.controller.ts` verifica Redis + Prisma |
| HEALTHCHECK en Dockerfiles | ✅ | `wget -qO- http://localhost:3000/health` en ambos |
| Alertas Railway | ⚠️ | Configurar en dashboard Railway — acción manual |

---

## Escalón 2 arrastre — Configuración ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| `.env.example` 5 servicios | ✅ | Creados en sesión 2026-09-30 |
| Sin secretos hardcodeados | ✅ | Verificado con grep en src/ — 0 resultados |
| `.env` en `.gitignore` | ✅ | Confirmado en raíz del monorepo |

## Escalón 4 arrastre — Base de Datos ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| Backups documentados | ✅ | roadmap/deuda-tecnica.md — DB-01 |
| Pool de conexiones documentado | ✅ | roadmap/deuda-tecnica.md — DB-02 |

---

## Sesión 2026-09-30 — qué se hizo

**CSS / Frontend:**
- ✅ .browserslistrc en raíz + 3 frontends (storefront conservador LATAM, dashboards modernos)
- ✅ postcss.config.mjs en 3 frontends — solo @tailwindcss/postcss (TW v4 canónico)
- ✅ packages/auth-client: imports ../ migrados a @/ + paths en tsconfig.json
- ✅ verify-alias-imports.sh — 416 archivos, 0 violaciones

**CI/CD (creado):**
- ✅ 7 GitHub Actions workflows con path filters + typecheck + build + pnpm audit
- ✅ .github/dependabot.yml
- ✅ .claude/conventions/deploy.md con rollback Railway

**Configuración (creado):**
- ✅ .env.example en los 5 servicios

**Documentación (creado):**
- ✅ .claude/roadmap/deuda-tecnica.md

## Resultado verify-fase2.sh (2026-09-30)

```
Total checks : 59  |  PASS: 50  |  FAIL: 0  |  WARN: 9
```
WARN son acciones manuales: branch protection GitHub + alertas Railway.

---

## Acciones manuales pendientes (no bloqueantes para Fase 3)

1. **Branch protection** — GitHub → Settings → Branches → main → requerir CI checks
2. **Alertas Railway** — Dashboard → servicio → Settings → notificaciones /health

---

**→ Fase 3 — Hardening:** 🔴 ACTIVA — ver `03-fase-hardening.md`
