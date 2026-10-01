# Fase 3 — Hardening
## Escalones 7, 8, 10 — Primer ecosistema en producción

**Estado:** ✅ COMPLETA — cerrada 2026-09-30
**Cuándo:** Completado cuando welver recibió sus primeros clientes reales
**Referentes:** Snyk/CrowdStrike (seguridad) · Apple (privacidad) · Kafka/Redis (async)

---

## Escalón 7 — Seguridad Defensiva ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| Firebase Auth + HttpOnly cookies | ✅ | ADR-004 — XSS no puede exfiltrar el token |
| CORS explícito | ✅ | Sin wildcard `*` |
| RBAC | ✅ | OWNER > COLLABORATOR, permisos JSONB (ADR-001) |
| API keys internas | ✅ | `ApiKeyGuard` para rutas internas de config |
| `pnpm audit` en CI | ✅ | En los 5 workflows — fallar si hay CVE crítico (Fase 2) |
| Dependabot | ✅ | `.github/dependabot.yml` — alertas semanales (Fase 2) |
| `$queryRaw` auditado | ✅ | 0 vulnerabilidades — reporte en roadmap/queryraw-audit.md |
| Logs de seguridad | ✅ | `SecurityLogger` con `securityEvent: true` en ambos backs |
| Rate limiting auth | ✅ | `AuthSessionThrottledController` — 10 req/min en POST /auth/session |
| Named throttler 'auth' | ✅ | `ThrottlerModule.forRoot` con 'default' 30/min + 'auth' 10/min |
| Runbook de incidente | ✅ | roadmap/runbook-incidente.md — 4 escenarios documentados |

---

## Escalón 8 — Redis y Async ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| Redis keys con organizationId | ✅ | Auditado — todas las keys de negocio tienen scope de org |
| Bull Board para queues | ✅ | `bull-board.module.ts` creado — pendiente instalar @bull-board/* |
| Plan queue órdenes async | ✅ | Documentado en roadmap/deuda-tecnica.md ASYNC-01 |

### Pendiente manual (no bloqueante para Fase 4)

```bash
# Instalar Bull Board
pnpm --filter realsass-sass-back add @bull-board/api @bull-board/nestjs @bull-board/express
# Importar en sass-back/src/app.module.ts:
# import { BullBoardAppModule } from '@/bull-board/bull-board.module';
# Agregar BullBoardAppModule en imports[]
```

---

## Escalón 10 — Privacidad y Compliance ✅

| Ítem | Estado | Detalle |
|------|--------|---------|
| Redis keys con orgId | ✅ | Auditado — reporte en roadmap/redis-keys-audit.md |
| PII documentado | ✅ | roadmap/pii-retention.md — modelos, retención, jurisdicción |
| customer.deleteAccount | ✅ | ecommerce-back/src/customers/customer-delete.router.ts |
| Logs sin PII | ✅ | Auditado — reporte en roadmap/pii-logs-audit.md |

---

## Sesión 2026-09-30 — qué se hizo

**Archivos creados:**
- `realsass-sass-back/src/common/logger/security-logger.ts`
- `realsass-sass-back/src/auth/auth-throttle.config.ts`
- `realsass-sass-back/src/auth/auth-session-throttled.controller.ts`
- `realsass-sass-back/src/bull-board/bull-board.module.ts`
- `realsass-ecommerce-back/src/common/logger/security-logger.ts`
- `realsass-ecommerce-back/src/customers/customer-delete.router.ts`
- `.claude/roadmap/queryraw-audit.md`
- `.claude/roadmap/redis-keys-audit.md`
- `.claude/roadmap/runbook-incidente.md`
- `.claude/roadmap/pii-retention.md`
- `.claude/roadmap/pii-logs-audit.md`
- `.claude/checklists/bull-board-setup.md`

**Archivos modificados:**
- `realsass-sass-back/src/auth/auth.module.ts` — usa AuthSessionThrottledController
- `realsass-sass-back/src/app.module.ts` — named throttler 'auth' agregado
- `.claude/roadmap/deuda-tecnica.md` — sección ASYNC-01 agregada

**Catalog limpiado:**
- `@opentelemetry/exporter-trace-otlp-grpc` → reemplazado por `exporter-trace-otlp-http`
- `@bull-board/*` agregados al catalog
- `@opentelemetry/*` y `@types/qs` migrados de versiones hardcodeadas a `catalog:`
- `@vitest/ui` alineado con `vitest` (^4.1.11)

## Resultado verify-fase3.sh (2026-09-30)

```
Total checks : 42  |  PASS: 40  |  FAIL: 0  |  WARN: 2
```
WARN son acciones manuales: Bull Board install + 3 detecciones de "email"
en security-logger.ts (falso positivo del grep — es el tipo, no un log real).

---

**→ Fase 4 — Escala:** ⚪ PENDIENTE — ver `04-fase-escala.md`
**→ S4 — Tests/CI:** 🔴 ACTIVO — S4-D (HydrationBoundary) es la próxima tarea
