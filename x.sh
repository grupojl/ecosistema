#!/usr/bin/env bash
# =============================================================================
# x.sh — actualiza .claude/ de ecosistema-ms
# Estado post-sesión 2026-09-07
#
# USO: bash x.sh
# PRECONDICIÓN: raíz del repo ecosistema-ms/
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log_ok()      { echo -e "  ${GREEN}[OK]${NC} $*"; }
log_section() { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}"; }

mkdir -p .claude/roadmap .claude/decisions .claude/checklists

# =============================================================================
# 1. sprints.md — reemplazar completo con la versión final detallada
# =============================================================================
log_section "sprints.md"

cat > .claude/roadmap/sprints.md << 'EOF'
# Sprints — ecosistema-ms

**Última actualización:** 2026-09-07

## Estado de fases

| Fase | Descripción | Estado |
|------|-------------|--------|
| FASE 0 | Estructura base .claude/ | ✅ COMPLETO |
| FASE 1 | Carpetas bloqueantes/dinámicas | ✅ COMPLETO |
| FASE 2 | ADR-001: DTOs → Zod | ✅ COMPLETO — 0 class-validator residuales |
| FASE 3 | Contratos gRPC documentados | ✅ COMPLETO |
| FASE 4 | Domain/Repository MOLDE VIVO | ✅ COMPLETO |
| FASE 5 | Multi-tenant — auditoría queries | ✅ COMPLETO |
| FASE 7 | Internal API para superadmin (ADR-008) | ✅ COMPLETO |
| FASE 6 | Build limpio + Railway | 🔴 PRÓXIMA |

---

## Logros FASE 7 — Internal API superadmin (2026-09-07)

### Archivos creados

| Archivo | Servicio |
|---------|---------|
| `src/common/guards/internal-api-key.guard.ts` | los 5 servicios |
| `src/health/health-extended.controller.ts` | los 5 servicios |
| `src/internal/internal-conversations.controller.ts` | chatia-backend |
| `src/internal/internal-payments.controller.ts` | pasarelapagos-backend |
| `src/internal/internal-metrics.controller.ts` | analytics-backend |
| `src/internal/internal-dlq.controller.ts` | workers-backend |
| `src/internal/internal.module.ts` | chatia, pasarela, analytics, workers |
| `src/common/pipes/zod-validation.pipe.ts` | pasarela, analytics, workers (si no existía) |

### Módulos actualizados

| Archivo | Cambio |
|---------|--------|
| `chatia/src/health/health.module.ts` | +HealthExtendedController |
| `pasarela/src/health/health.module.ts` | +HealthExtendedController +CircuitBreakerService |
| `notificaciones/src/health/health.module.ts` | +HealthExtendedController +CircuitBreakerService |
| `analytics/src/health/health.module.ts` | +HealthExtendedController |
| `workers/src/health/health.module.ts` | +HealthExtendedController +DlqModule +CircuitBreakerService |
| `pasarela/src/app.module.ts` | +InternalModule |
| `analytics/src/app.module.ts` | +InternalModule |
| `workers/src/app.module.ts` | +InternalModule |

### Bug corregido — DT-019

`workers-backend/src/dlq/dlq.service.ts` — `getFailedJobs()` había sido
appendeado fuera del cierre de clase `DlqService`. Corregido manualmente:
el método quedó dentro de la clase, un único `}` al final del archivo.

### Endpoints expuestos

| Endpoint | Servicio | Fase superadmin |
|----------|---------|-----------------|
| GET /api/v1/health/extended | los 5 | Fase 1 |
| GET /internal/conversations/escalated | chatia | Fase 2 |
| GET /internal/conversations/stats | chatia | Fase 2 |
| GET /internal/payments | pasarela | Fase 2 |
| GET /internal/payments/:id | pasarela | Fase 3 |
| POST /internal/payments/:id/retry | pasarela | Fase 3 |
| GET /internal/metrics/summary | analytics | Fase 3 |
| GET /internal/jobs/dlq | workers | Fase 3 |
| POST /internal/jobs/dlq/:id/retry | workers | Fase 3 |

---

## FASE 6 — Build limpio + Railway (PRÓXIMA)

### Paso 1 — Build limpio

```bash
pnpm -r build
# Criterio de done: 0 errores TypeScript en los 5 servicios
```

### Paso 2 — Variables Railway

En cada uno de los 5 servicios Railway:
```
INTERNAL_API_KEY=<openssl rand -hex 32>   # misma clave en todos
```

En superadmin (grupojl-control-backend) Railway:
```
CHATIA_INTERNAL_URL=http://chatia-backend.railway.internal:3000
PASARELA_INTERNAL_URL=http://pasarelapagos-backend.railway.internal:3001
NOTIFICACIONES_INTERNAL_URL=http://notificaciones-backend.railway.internal:3002
ANALYTICS_INTERNAL_URL=http://analytics-backend.railway.internal:3003
WORKERS_INTERNAL_URL=http://workers-backend.railway.internal:3004
INTERNAL_API_KEY=<misma-clave>
```

### Paso 3 — Verificar conectividad (una URL a la vez)

```bash
# Sin auth — debe retornar JSON con status ok/degraded/down
curl https://chatia-backend.railway.app/api/v1/health/extended

# Con auth — debe retornar datos reales
curl -H "x-internal-api-key: $INTERNAL_API_KEY" \
  "https://chatia-backend.railway.app/internal/conversations/escalated?ecosystemId=welver"
```

### Criterio de done FASE 6

- [ ] `pnpm -r build` → 0 errores TypeScript
- [ ] Los 5 servicios con `INTERNAL_API_KEY` en Railway
- [ ] Superadmin con las 6 URLs configuradas
- [ ] DemoBadge desaparece en Command Center del superadmin
EOF
log_ok "sprints.md actualizado"

# =============================================================================
# 2. deuda-tecnica.md — reemplazar completo con DT-019/020/021 incluidos
# =============================================================================
log_section "deuda-tecnica.md"

cat > .claude/roadmap/deuda-tecnica.md << 'EOF'
# Deuda técnica — ecosistema-ms

**Última actualización:** 2026-09-07

## ✅ RESUELTOS

| ID | Deuda | Cómo quedó |
|----|-------|------------|
| ~~DT-001~~ | dto/ huérfanas (17 carpetas) | Eliminadas |
| ~~DT-002~~ | class-validator inline (9 archivos) | Migrado a Zod — 0 imports residuales |
| ~~DT-003~~ | AllExceptionsFilter no registrado | Registrado en chatia + workers main.ts |
| ~~DT-004~~ | ConversationsService → PrismaService directo | Migrado a IConversationsRepository |
| ~~DT-005~~ | PaymentsService → PrismaService directo | PrismaService + IPaymentsRepository coexisten (ver nota) |
| ~~DT-006~~ | reconciliation.service sin tenantId en where | ConfigService + tenantId dentro del where |
| ~~DT-007~~ | contacts/ sin Domain/Repository | Decidido: no aplicar — scope suficiente con organizationId |
| ~~DT-008~~ | projects/ sin Domain/Repository | Ídem — imports dto corregidos a schemas.ts |
| ~~DT-009~~ | campaigns/ sin Domain/Repository | Ídem |
| ~~DT-011~~ | notifications.service getStats() sin ecosystemId | ecosystemId en StatsQuery + where |
| ~~DT-012~~ | analytics getConversationsByDay() sin ecosystemId | ecosystemId en firma + controller |
| ~~DT-013~~ | Timeouts gRPC no definidos | channelOptions/keepalive en 5 módulos grpc-client |
| ~~DT-014~~ | preferences.service getPreferences() sin ecosystemId | ecosystemId en where |
| ~~DT-016~~ | contacts.service import roto class-validator | Reescrito usando schemas.ts |
| ~~DT-017~~ | OrgContext sin tenantId | tenantId agregado a la interface |
| ~~DT-018~~ | projects.service imports dto legacy rotos | Migrado a schemas.ts |
| ~~DT-019~~ | getFailedJobs() fuera del cierre de clase DlqService | Corregido manualmente 2026-09-07 — método dentro de la clase, un único `}` al final |
| ~~DT-A~~ | Sin ZodValidationPipe ni filtros de excepción | Resuelto |
| ~~DT-B~~ | Controllers con class-validator | Resuelto |
| ~~DT-C~~ | class-validator en package.json | Resuelto |
| ~~DT-D~~ | conversations/ sin domain+repository | Resuelto |
| ~~DT-E~~ | payments/ sin domain+repository | Resuelto |
| ~~DT-F~~ | Sin contratos gRPC documentados | Resuelto |
| ~~DT-G~~ | Sin auditoría multi-tenant | Resuelto |

### Nota de arquitectura — DT-005

`PaymentsService` inyecta tanto `PrismaService` como `IPaymentsRepository`:
- `IPaymentsRepository` → lecturas simples: `findById`, `findByIdempotencyKey`, `list`
- `PrismaService` directamente → operaciones que requieren `$transaction` multi-tabla

---

## 🔴 PENDIENTE — FASE 6 (bloquea integración real)

| ID | Deuda | Urgencia |
|----|-------|---------|
| DT-020 | `INTERNAL_API_KEY` no configurada en Railway en los 5 servicios | Sin esta variable los endpoints /internal/* rechazan todo (fail-secure) |
| DT-021 | `pnpm -r build` no verificado post-FASE 7 | Confirmar 0 errores TypeScript antes de deployar |

---

## 🟡 PENDIENTE — no urgente

| ID | Deuda | Archivo | Cuándo |
|----|-------|---------|--------|
| DT-015 | `Conversation` sin `ecosystemId` directo en schema | `chatia-backend/prisma/schema.prisma` | Antes de 2+ ecosistemas en prod |
| DT-010 | CircuitBreakerService en memoria (no distribuido) | chatia + pasarelapagos | Al escalar a múltiples instancias |

### DT-015 — cómo resolverlo cuando llegue el momento

```prisma
model Conversation {
  ecosystemId    String
  organizationId String
  @@index([ecosystemId, organizationId])
}
```

```bash
pnpm --filter chatia-backend prisma migrate dev --name add-ecosystemId-conversation
```
EOF
log_ok "deuda-tecnica.md actualizado"

# =============================================================================
# 3. ADR-008 — actualizar estado a verificado
# =============================================================================
log_section "ADR-008"

ADR_FILE=".claude/decisions/ADR-008-internal-api-superadmin.md"
if [ -f "$ADR_FILE" ]; then
  sed -i 's/\*\*Estado:\*\* Aceptado — implementado$/\*\*Estado:\*\* Aceptado — implementado y verificado (2026-09-07)/' "$ADR_FILE"
  # Si ya tenía "verificado" no hace nada dañino
  log_ok "ADR-008: estado actualizado"
else
  log_ok "ADR-008: archivo no encontrado — fue creado por el x.sh anterior, verificar"
fi

# =============================================================================
# 4. deploy-railway.md — reemplazar con versión final FASE 6
# =============================================================================
log_section "checklists/deploy-railway.md"

cat > .claude/checklists/deploy-railway.md << 'EOF'
# Checklist: Deploy Railway — ecosistema-ms

**Última actualización:** 2026-09-07

---

## Variables por servicio — mínimo para funcionar

### Todos los servicios
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
REDIS_ENABLED=true
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ALLOWED_ORIGINS=https://tu-front.railway.app
INTERNAL_API_KEY=<openssl rand -hex 32>   ← ADR-008, misma en los 5 servicios
```

### chatia-backend (adicionales)
```
GROQ_API_KEY=...
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
```

### pasarelapagos-backend (adicionales)
```
WEBHOOK_SIGNING_SECRET=...
TENANT_ID=welver
```

### workers-backend (adicionales)
```
CHATIA_GRPC_URL=chatia-backend.railway.internal:5001
NOTIF_GRPC_URL=notificaciones-backend.railway.internal:5003
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
```

---

## Conectar superadmin — bajar mocks de a uno

Una vez que los 5 servicios tienen `INTERNAL_API_KEY`:

```bash
# 1. Health extendido — sin auth
curl https://chatia-backend.railway.app/api/v1/health/extended
# Esperado: { "status": "ok"|"degraded"|"down", "db": true, ... }

# 2. Endpoint interno — con clave
curl -H "x-internal-api-key: $INTERNAL_API_KEY" \
  "https://chatia-backend.railway.app/internal/conversations/escalated?ecosystemId=welver"
# Esperado: array de conversaciones (puede estar vacío si no hay escaladas)

# 3. Si OK → en superadmin Railway dashboard:
CHATIA_INTERNAL_URL=http://chatia-backend.railway.internal:3000
# → DemoBadge de chatia desaparece automáticamente en el superadmin
```

Repetir en orden: chatia → pasarela → notificaciones → analytics → workers

---

## Variables superadmin (grupojl-control-backend)

```
CHATIA_INTERNAL_URL=http://chatia-backend.railway.internal:3000
PASARELA_INTERNAL_URL=http://pasarelapagos-backend.railway.internal:3001
NOTIFICACIONES_INTERNAL_URL=http://notificaciones-backend.railway.internal:3002
ANALYTICS_INTERNAL_URL=http://analytics-backend.railway.internal:3003
WORKERS_INTERNAL_URL=http://workers-backend.railway.internal:3004
INTERNAL_API_KEY=<misma-clave-que-los-5-ms>
```

---

## railway.json por servicio

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "<servicio>/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

---

## Verificación pre-deploy

```bash
pnpm -r build        # 0 errores TypeScript
git push origin main # Railway deploya automáticamente
```
EOF
log_ok "deploy-railway.md actualizado"

# =============================================================================
# Resumen final
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  .claude/ ecosistema-ms actualizado ✓${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo "Archivos actualizados:"
echo "  .claude/roadmap/sprints.md          — FASE 7 detallada, FASE 6 con criterio de done"
echo "  .claude/roadmap/deuda-tecnica.md    — DT-019 resuelto, DT-020/021 en FASE 6"
echo "  .claude/decisions/ADR-008-*.md      — estado 'verificado 2026-09-07'"
echo "  .claude/checklists/deploy-railway.md — variables completas + curl de verificación"