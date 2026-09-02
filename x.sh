#!/usr/bin/env bash
# =============================================================================
# x-lifecycle-welver.sh — Agrega .claude/lifecycle/ a ecosistema (welver/)
# Ejecutar desde la RAÍZ del monorepo grupojl/welver: bash x-lifecycle-welver.sh
# Es idempotente — sobreescribe si ya existe.
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIFECYCLE_DIR="$ROOT_DIR/.claude/lifecycle"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  welver/ — inicialización de .claude/lifecycle/             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "→ Destino: $LIFECYCLE_DIR"
echo ""

mkdir -p "$LIFECYCLE_DIR"

# =============================================================================
# README.md
# =============================================================================
cat > "$LIFECYCLE_DIR/README.md" << 'EOF'
# Lifecycle — Software de Clase Mundial

Los 13 escalones que llevan welver/ al top 5-10% mundial.
Organizados en 4 fases de construcción — en orden de ejecución, no de importancia.

## Por qué este orden

El error que mata proyectos es implementar el escalón 9 antes de tener sólido
el escalón 1. Los escalones más altos son inútiles si los fundamentos fallan.
Netflix tiene Chaos Engineering porque primero tuvo arquitectura limpia.

## Las 4 fases

| Fase | Cuándo | Escalones | Estado |
|------|--------|-----------|--------|
| [Desarrollo](01-fase-desarrollo.md) | Ahora | 1, 2, 4 | 🟡 Avanzado |
| [Estabilización](02-fase-estabilizacion.md) | Antes de producción | 3, 5, 6 | 🔴 En curso |
| [Hardening](03-fase-hardening.md) | Primer ecosistema en prod | 7, 8, 10 | ⚪ Pendiente |
| [Escala](04-fase-escala.md) | 3 ecosistemas simultáneos | 9, 11, 12, 13 | ⚪ Pendiente |

## Los 13 escalones completos

| # | Escalón | Referente mundial | Fase | Estado welver |
|---|---------|-------------------|------|---------------|
| 1 | Código — Arquitectura y Calidad | Stripe · SQLite | Desarrollo | 🟡 9/10 |
| 2 | Configuración y Entorno | Twelve-Factor App · Heroku | Desarrollo | ✅ 9.5/10 |
| 3 | Infraestructura y Red | Cloudflare | Estabilización | ⚠️ Parcial |
| 4 | Base de Datos y Almacenamiento | PlanetScale · Supabase | Desarrollo | 🟡 8/10 |
| 5 | CI/CD y Despliegues | Vercel · GitHub | Estabilización | ❌ No iniciado |
| 6 | Observabilidad y Operaciones | Datadog | Estabilización | ❌ No iniciado |
| 7 | Seguridad Defensiva (SecOps) | Snyk · CrowdStrike | Hardening | ⚪ Pendiente |
| 8 | Cumplimiento Legal y Privacidad | Apple | Hardening | ⚪ Pendiente |
| 9 | Recuperación ante Desastres | AWS | Escala | ⚪ Pendiente |
| 10 | Datos Masivos y Async | Apache Kafka · Redis | Hardening | ⚪ Pendiente |
| 11 | Rendimiento Percibido (UX) | Linear · Figma | Escala | ⚪ Pendiente |
| 12 | Alta Disponibilidad y Chaos | Netflix | Escala | ⚪ Pendiente |
| 13 | Eficiencia Financiera (FinOps) | Airbnb · Uber | Escala | ⚪ Pendiente |

## Capa 0 — lo que sostiene los 13 escalones

Cultura de ingeniería documentada. ADRs, reglas duras, moldes vivos, checklists.
Sin esto, los 13 escalones colapsan cuando escala el equipo.
Welver tiene esto documentado en `.claude/` — es la ventaja diferencial.

## Posición objetivo

Con los 13 escalones sólidos + base documental:
**Top 5-10% mundial · Top 1% Latinoamérica**

El salto al top 1% mundial lo da el tiempo bajo carga real en producción,
no una decisión de arquitectura.
EOF
echo "✓ lifecycle/README.md"

# =============================================================================
# 01-fase-desarrollo.md — Escalones 1, 2, 4
# =============================================================================
cat > "$LIFECYCLE_DIR/01-fase-desarrollo.md" << 'EOF'
# Fase 1 — Desarrollo
## Escalones 1, 2, 4 — La base que hace cosmético todo lo demás

**Estado:** 🟡 Avanzado — bloqueantes activos en Escalón 1
**Cuándo:** Ahora — resolver bloqueantes antes de pasar a Fase 2
**Referentes:** Stripe (código) · Twelve-Factor App (config) · PlanetScale (DB)

---

## Escalón 1 — Código: Arquitectura y Calidad

### Estado actual — 9/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| TypeScript strict | ✅ | ADR-007 implementado — `toEntity()` en 11 repositories de sass-back |
| Domain/Repository sass-back | ✅ | 11 módulos con domain/ + repository/ |
| Domain/Repository ecommerce-back | ⚠️ Parcial | Solo `catalog/` — cart, orders, customers, inventory pendientes |
| tRPC exclusivo sass-back | ✅ | 11 routers, Zod inline, sin DTOs class-validator nuevos |
| tRPC exclusivo ecommerce-back | ⚠️ BLOQUEANTE | Controllers REST legacy pendientes de eliminar (ADR-005) |
| DTOs class-validator sass-back | ⚠️ Pendiente | Sobreviven en controllers REST legacy a eliminar |
| Multi-tenant organizationId | ✅ | Respetado en todos los modelos |
| Sin cross-service imports | ✅ | Dockerfile de cada servicio solo copia su carpeta + packages/ |
| Sin `as any` repositories | ✅ | ADR-007 implementado |
| ecommerce-front tRPC server caller | ⚠️ BLOQUEANTE | lib/store/client.ts usa fetch REST (ADR-006) |

### Bloqueantes activos

**[BLOQUEANTE-1] Eliminar controllers REST de ecommerce-back** (ADR-005)
Los controllers REST de catalog, inventory, orders, cart, customers, store
deben eliminarse — los routers tRPC ya existen y los reemplazan.
→ Ver `.claude/checklists/backend-capa-2-router.md`
→ Ver `.claude/decisions/ADR-005-rest-to-trpc.md`

**[BLOQUEANTE-2] ecommerce-front → tRPC server caller** (ADR-006)
`lib/store/client.ts`, `lib/store/resolver.ts`, `context/customer-context.tsx`
usan fetch REST manual donde debe ir tRPC server caller.
→ Ver `.claude/checklists/frontend-capa-1-fetch.md`

### Pendiente no bloqueante

- Domain/Repository en ecommerce-back: `cart/`, `orders/`, `customers/`, `inventory/`
  → Ver `.claude/checklists/backend-capas-3-4-domain-repo.md`

### Cómo saber que este escalón está completo

- `grep -r "class-validator" realsass-ecommerce-back/src` → 0 resultados
- `grep -r "class-validator" realsass-sass-back/src` → 0 resultados
- `lib/store/client.ts` eliminado — reemplazado por tRPC server caller
- `cart/`, `orders/`, `customers/` tienen domain/ + repository/
- `tsc --noEmit` pasa en los 2 backs y los 3 fronts sin errores

### Referente: por qué Stripe

La API de Stripe es el estándar de ergonomía y tipado. Cada method retorna
un tipo explícito, cada error está tipado, cada input validado con schema.
En welver, el equivalente es: un ingeniero nuevo puede leer cualquier router
tRPC y saber exactamente qué acepta, qué valida y qué retorna — sin preguntar.

---

## Escalón 2 — Configuración y Entorno

### Estado actual — 9.5/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| Catalog único pnpm | ✅ | `catalog:` default — sin named catalogs (ADR-002) |
| Variables por Dockerfile | ✅ | `ARG`/`ENV` declarados en cada Dockerfile |
| Sin `.env` compartido | ✅ | Cada servicio declara sus propias vars |
| CORS explícito | ✅ | `ALLOWED_ORIGINS` sin wildcard — sass-back no arranca sin él |
| Secretos fuera del código | ✅ | Firebase private key via Railway env vars |
| pnpm 10 + Node 24 | ✅ | Documentado en conventions/entorno.md |

### Pendiente mínimo

- [ ] Verificar que `.env.example` existe en cada servicio con todas las vars requeridas
- [ ] Validación de env vars al arranque en cada `main.ts` — falla con mensaje claro si falta una var

### Cómo saber que este escalón está completo

- Cada servicio tiene `.env.example` completo y actualizado
- El servicio falla en arranque con mensaje claro si falta una var obligatoria
- `git grep -r "PRIVATE_KEY\|-----BEGIN" --include="*.ts"` → 0 resultados con valores reales

---

## Escalón 4 — Base de Datos y Almacenamiento

### Estado actual — 8/10

| Ítem | Estado | Detalle |
|------|--------|---------|
| Prisma ORM | ✅ | Schema declarativo, dos DBs separadas (sass + ecommerce) |
| Migraciones versionadas | ✅ | `prisma/migrations/` en cada back |
| DB separada por back | ✅ | `realsass-sass-back` y `realsass-ecommerce-back` tienen `DATABASE_URL` propia |
| Multi-tenant `organizationId` | ✅ | En todos los modelos con datos de negocio |
| Índices en `organizationId` | ⚠️ Verificar | Confirmar `@@index([organizationId])` en modelos de alta frecuencia |
| Backups automáticos | ⚠️ Railway | Verificar política de backups y RPO resultante |
| Pool de conexiones | ⚠️ Verificar | Con múltiples réplicas Railway, el pool puede ser cuello de botella |
| `prisma migrate deploy` en Dockerfile | ⚠️ Verificar | Confirmar que migra antes del start, no después |

### Qué hay que hacer

1. **Verificar índices** — todo modelo con `organizationId` de alta frecuencia de consulta
   debe tener `@@index([organizationId])`. Sin índice = query lento a escala.

2. **Confirmar política de backups Railway** — documentar RPO resultante.

3. **Confirmar orden en Dockerfile** — `prisma migrate deploy` antes del `CMD`.

4. **Pool de conexiones** — documentar límite por servicio. Con N réplicas Railway
   de cada back, el límite de conexiones de PostgreSQL es `N × pool_size`.

### Cómo saber que este escalón está completo

- Índices en `organizationId` confirmados en ambos schemas
- `prisma migrate deploy` antes del `CMD` en los 2 Dockerfiles de backs
- Backups automáticos confirmados con RPO documentado
- Límites de pool documentados en `services/realsass-sass-back.md` y `services/realsass-ecommerce-back.md`
EOF
echo "✓ lifecycle/01-fase-desarrollo.md"

# =============================================================================
# 02-fase-estabilizacion.md — Escalones 3, 5, 6
# =============================================================================
cat > "$LIFECYCLE_DIR/02-fase-estabilizacion.md" << 'EOF'
# Fase 2 — Estabilización
## Escalones 3, 5, 6 — Antes de producción real

**Estado:** 🔴 En curso — escalón 3 parcial, 5 y 6 no iniciados
**Cuándo:** Antes de que el primer cliente real use el sistema
**Referentes:** Cloudflare (infra) · Vercel/GitHub (CI/CD) · Datadog (observabilidad)

---

## Escalón 3 — Infraestructura y Red

### Estado actual — Parcial

| Ítem | Estado | Detalle |
|------|--------|---------|
| HTTPS | ✅ Railway | TLS automático en todos los servicios |
| CORS explícito | ✅ | `ALLOWED_ORIGINS` sin wildcard en sass-back y ecommerce-back |
| Cookies HttpOnly | ✅ | ADR-004 implementado — `__session` HttpOnly + SameSite=Strict |
| Helmet | ⚠️ Verificar | Confirmar que `@nestjs/helmet` está activo en ambos backs |
| Rate limiting | ❌ No implementado | Ningún back tiene rate limiting configurado |
| Red privada Railway | ✅ | Los backs se comunican via URL privada Railway |
| Firewall puertos | ⚠️ Verificar | Confirmar que solo el puerto 3000 es público en cada servicio |

### Qué hay que hacer

1. **Agregar Helmet** — en `main.ts` de cada back:
   ```ts
   import helmet from 'helmet';
   app.use(helmet());
   ```

2. **Rate limiting** — con `@nestjs/throttler`:
   - Límite general por IP en todos los endpoints
   - Límite estricto en `POST /auth/session` — es el endpoint más sensible
   - Límite por `organizationId` para endpoints de datos

3. **Confirmar puertos Railway** — verificar que solo el 3000 (HTTP) es público.
   El tRPC no necesita puertos adicionales — viaja sobre HTTP.

### Cómo saber que este escalón está completo

- Helmet activo en los 2 backs
- Rate limiting activo en endpoints de auth y datos
- `curl -I https://{servicio}.railway.app` muestra headers de seguridad

---

## Escalón 5 — CI/CD y Despliegues

### Estado actual — ❌ No iniciado

Railway hace deploy automático en push a main. Pero sin CI gate:
un PR que rompe el build de un front puede llegar a producción.

| Ítem | Estado | Detalle |
|------|--------|---------|
| Deploy automático Railway | ✅ | Push a main → deploy automático |
| Typecheck en CI | ❌ | No hay GitHub Actions configurado |
| Tests en CI | ❌ | No hay tests (S4 pendiente) |
| Build gate en PR | ❌ | PRs pueden mergearse aunque rompan typecheck |
| Rollback documentado | ❌ | No hay procedimiento documentado |

### Qué hay que hacer

1. **GitHub Actions por servicio** con path filters:

   ```yaml
   # .github/workflows/realsass-sass-back.yml
   name: sass-back
   on:
     push:
       paths:
         - 'realsass-sass-back/**'
         - 'packages/**'
         - 'pnpm-workspace.yaml'
   jobs:
     ci:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v3
           with: { version: 10 }
         - run: pnpm install --frozen-lockfile
         - run: pnpm --filter realsass-sass-back typecheck
         - run: pnpm --filter realsass-sass-back build
   ```

2. **Un workflow por servicio** — 7 workflows:
   `realsass-sass-back`, `realsass-ecommerce-back`, `realsass-sass-front`,
   `realsass-dashboard-front`, `real-ecommerce-front`, `packages/auth-server`,
   `packages/trpc`

3. **Branch protection en GitHub** — main no permite merge si CI falla.

4. **Typecheck cruzado** — cuando cambia un router tRPC de sass-back,
   correr typecheck de los 3 fronts. Si un procedure cambió y rompe un front,
   el PR no puede mergearse.

5. **Rollback documentado** — Railway guarda el build anterior. Documentar
   el procedimiento en `conventions/deploy.md`.

### Cómo saber que este escalón está completo

- 7 workflows de GitHub Actions activos
- Un PR que rompe `tsc` no puede mergearse a main
- Rollback documentado y probado al menos una vez

---

## Escalón 6 — Observabilidad y Operaciones

### Estado actual — ❌ No iniciado (OpenTelemetry en roadmap S4)

| Ítem | Estado | Detalle |
|------|--------|---------|
| Health checks | ✅ | `GET /health` en los 2 backs via `@nestjs/terminus` |
| Logging estructurado | ⚠️ Verificar | Confirmar formato JSON vs texto plano |
| Métricas Prometheus | ⚠️ Parcial | Dependencias en catalog pero sin configuración visible |
| OpenTelemetry | ❌ S4 pendiente | `@opentelemetry/sdk-node` en catalog — no configurado |
| Correlation ID | ❌ | Sin trazabilidad de requests entre backs |
| Alertas | ❌ | Sin alertas cuando algo falla |
| Dashboard | ❌ | Sin visibilidad del estado del sistema |

### Qué hay que hacer

1. **Logging JSON estructurado** — cada log debe incluir:
   ```json
   {
     "level": "error",
     "service": "realsass-sass-back",
     "organizationId": "org_123",
     "correlationId": "req_abc",
     "message": "Organization not found",
     "timestamp": "2026-09-01T00:00:00Z"
   }
   ```

2. **Correlation ID en tRPC** — generar un `correlationId` en cada request
   y propagarlo en llamadas HTTP entre backs (sass-back → ecommerce-back).

3. **Métricas Prometheus** — activar la configuración que ya está en catalog:
   - `http_requests_total` por endpoint y status
   - `trpc_requests_total` por procedure y resultado
   - `prisma_query_duration_seconds`

4. **Health check mejorado** — el actual verifica Prisma + memoria.
   Agregar verificación de Redis.

5. **Alertas básicas** — Railway puede notificar cuando el health check falla.
   Configurar notificación a email o Slack.

### Cómo saber que este escalón está completo

- Logs son JSON con `organizationId` y `correlationId`
- Prometheus `/metrics` activo en los 2 backs
- Un error en ecommerce-back es trazable hasta sass-back en los logs
- Alerta configurada cuando `/health` falla
EOF
echo "✓ lifecycle/02-fase-estabilizacion.md"

# =============================================================================
# 03-fase-hardening.md — Escalones 7, 8, 10
# =============================================================================
cat > "$LIFECYCLE_DIR/03-fase-hardening.md" << 'EOF'
# Fase 3 — Hardening
## Escalones 7, 8, 10 — Primer ecosistema en producción

**Estado:** ⚪ Pendiente — iniciar cuando Fase 2 esté completa
**Cuándo:** Cuando welver recibe sus primeros clientes reales con datos sensibles
**Referentes:** Snyk/CrowdStrike (seguridad) · Apple (privacidad) · Kafka/Redis (async)

---

## Escalón 7 — Seguridad Defensiva (SecOps)

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| Firebase Auth + HttpOnly cookies | ✅ | ADR-004 — XSS no puede exfiltrar el token |
| CORS explícito | ✅ | Sin wildcard `*` |
| RBAC | ✅ | OWNER > COLLABORATOR, permisos JSONB (ADR-001) |
| API keys internas | ✅ | `ApiKeyGuard` para rutas internas de config |
| Escaneo de dependencias | ❌ | Sin `pnpm audit` en CI |
| Rate limiting | ❌ | No implementado |
| Runbook de incidente | ❌ | No documentado |

### Qué hay que hacer

1. **`pnpm audit` en CI** — agregar en todos los workflows. Fallar si hay
   vulnerabilidades críticas o altas.

2. **Rate limiting en endpoints sensibles**:
   - `POST /auth/session` — máximo 10 intentos por IP por minuto
   - `POST /ecommerce/public/*/customers/identify` — máximo 20 por IP por minuto
   - Endpoints de datos: límite por `organizationId`

3. **Dependabot o Snyk** — alertas automáticas cuando una dependencia
   tiene CVE crítico. Sin esto, una vulnerabilidad en `firebase-admin`
   puede pasar desapercibida semanas.

4. **Auditar `$queryRaw`** — verificar que ningún uso de Prisma raw queries
   tiene interpolación de strings sin sanitizar.

5. **Logs de seguridad** — autenticaciones fallidas, intentos cross-tenant,
   rate limit hits — con campo `securityEvent: true` para poder filtrarlos.

6. **Runbook de incidente de seguridad** — qué hacer si:
   - Se detecta acceso no autorizado a datos de una organización
   - Un token de Firebase se compromete
   - Las API keys internas se filtran

### Cómo saber que este escalón está completo

- `pnpm audit` en CI — 0 vulnerabilidades críticas o altas
- Rate limiting activo en endpoints de auth e identificación
- Logs de seguridad filtrables en producción
- Runbook documentado y revisado por el equipo

---

## Escalón 8 — Cumplimiento Legal y Privacidad

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| HTTPS (tránsito) | ✅ | Railway TLS automático |
| Cookies HttpOnly | ✅ | ADR-004 — token inaccesible para JS |
| Cifrado en reposo | ⚠️ Railway | Verificar política de Railway PostgreSQL |
| Datos de cliente (ecommerce) | ⚠️ | Email de cliente en texto plano — revisar si aplica cifrado |
| Soft-delete colaboradores | ✅ | `Collaborator` tiene soft-delete via status |
| Retención de datos | ❌ | No definida |
| Derecho al olvido | ❌ | No implementado |

### Qué hay que hacer

1. **Definir política de retención** — por tipo de dato:
   - Datos de organización: ¿cuánto tiempo después de cancelar?
   - Datos de clientes del ecommerce: ¿cuánto tiempo?
   - Logs de auditoría: ¿cuánto tiempo? (puede tener requisito legal)
   - Logs de sistema: ¿cuánto tiempo?

2. **Proceso de eliminación de datos** — cuando una organización cancela
   o un cliente pide borrar sus datos:
   - Soft-delete primero
   - Hard-delete según política de retención

3. **Verificar cifrado en Railway** — PostgreSQL en Railway cifra datos en reposo
   a nivel de disco. Confirmar y documentar.

4. **Términos de servicio y privacidad** — deben existir y estar accesibles
   antes de que cualquier cliente almacene datos en producción.

### Cómo saber que este escalón está completo

- Política de retención de datos documentada
- Proceso de eliminación de datos documentado (aunque sea manual al principio)
- Términos de servicio y política de privacidad publicados
- Test: soft-delete de una organización elimina acceso a todos sus datos

---

## Escalón 10 — Datos Masivos y Procesamiento Asíncrono

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| Redis caché | ✅ | `RedisService` + `ConfigCacheService` en los 2 backs |
| BullMQ queues | ✅ | `webhook-delivery.processor.ts` en sass-back |
| DLQ webhook | ✅ | Reintentos en webhook delivery |
| Caché de tenant (ecommerce) | ✅ | `OrganizationsClientService` con Redis cache + MemoryCache fallback |
| BullMQ en ecommerce-back | ❌ | No configurado — orders/checkout no usan queues |
| Caché de configuración | ✅ | `ConfigCacheService` en sass-back |
| Claves de caché con scope | ⚠️ Verificar | Confirmar que las keys incluyen `organizationId` |

### Qué hay que hacer

1. **Auditar claves de caché** — todas las keys de Redis deben incluir
   `organizationId` como prefijo para evitar colisiones entre tenants:
   ```ts
   // ❌ Clave sin scope
   cacheKey = `config:${configKey}`
   // ✅ Clave con scope
   cacheKey = `${organizationId}:config:${configKey}`
   ```

2. **Queue para checkout/órdenes** — `OrdersService.checkout()` hoy es
   síncrono. Cuando `pagos-back` exista, el procesamiento de pago debería
   ser asíncrono con BullMQ para no bloquear el request.

3. **Queue para webhooks ecommerce** — cuando `pagos-back` emita webhooks
   de pago confirmado → queue en ecommerce-back para actualizar el estado
   de la orden sin acoplamiento síncrono.

4. **Monitor de queues** — Bull Board para ver en tiempo real el estado de
   los jobs de webhook delivery.

### Cómo saber que este escalón está completo

- Todas las claves de Redis incluyen `organizationId`
- Bull Board activo para monitorear webhook delivery queue
- Plan documentado para queue de órdenes cuando pagos-back exista
EOF
echo "✓ lifecycle/03-fase-hardening.md"

# =============================================================================
# 04-fase-escala.md — Escalones 9, 11, 12, 13
# =============================================================================
cat > "$LIFECYCLE_DIR/04-fase-escala.md" << 'EOF'
# Fase 4 — Escala
## Escalones 9, 11, 12, 13 — 3 ecosistemas simultáneos

**Estado:** ⚪ Pendiente — iniciar cuando Fase 3 esté completa
**Cuándo:** Cuando welver, y otros ecosistemas operan simultáneamente
**Referentes:** AWS (DR) · Linear/Figma (UX) · Netflix (Chaos) · Airbnb/Uber (FinOps)

---

## Escalón 9 — Recuperación ante Desastres

### Qué hay que hacer

1. **Definir RTO y RPO por servicio**:

   | Servicio | RTO objetivo | RPO objetivo |
   |---|---|---|
   | `realsass-sass-back` | < 5 min | < 1 min |
   | `realsass-ecommerce-back` | < 5 min | < 1 min |
   | `realsass-sass-front` | < 2 min | N/A (stateless) |
   | `realsass-dashboard-front` | < 2 min | N/A (stateless) |
   | `real-ecommerce-front` | < 2 min | N/A (stateless) |

2. **Backups verificados** — probar restauración de backup en staging.
   Un backup que nunca se probó no existe.

3. **Redis con persistencia AOF** — confirmar que los datos de caché
   críticos (tenant context) se recuperan si Redis reinicia.

4. **Runbook de recuperación** — documentar paso a paso qué hacer cuando:
   - La DB de sass-back se corrompe
   - Railway tiene un incidente parcial
   - ecommerce-back queda en loop de crash

5. **Drill de recuperación** — simular la caída de sass-back y medir
   cómo afecta a ecommerce-back (que depende de él para validar tenants).

### Cómo saber que este escalón está completo

- RTO/RPO definidos y documentados
- Restauración de backup probada exitosamente en staging
- Runbooks escritos para los 3 escenarios más probables
- Drill de recuperación ejecutado y documentado

---

## Escalón 11 — Rendimiento Percibido y UX (Latency-Zero)

### Qué hay que hacer

1. **Medir latencias actuales** — `p50`, `p95`, `p99` por procedure tRPC.
   Antes de optimizar, medir.

2. **HydrationBoundary en Server Components** — todos los Server Components
   deben usar `<HydrationBoundary>` para pasar datos prefetcheados al client.
   Sin esto, el Client Component hace un refetch inicial innecesario.
   → Ver `.claude/checklists/frontend-capa-2-tanstack.md`

3. **Paginación en todos los listados** — `collaborators.list`, `catalog.list`,
   `orders.list` — ningún procedure devuelve un array sin límite.
   Sin paginación, el primer cliente con 10.000 productos rompe la API.

4. **Optimistic updates** — operaciones de baja criticidad (toggle de flag,
   cambio de tema) deben actualizarse en la UI antes de recibir confirmación
   del back. TanStack Query tiene soporte nativo para esto.

5. **ISR en ecommerce-front** — el catálogo público debe servirse desde caché
   CDN con revalidación, no en tiempo real por cada visita.

6. **Índices de DB optimizados** — medir queries lentas con `EXPLAIN ANALYZE`.
   Un query sin índice que tarda 2ms con 100 registros tarda 2s con 100.000.

### Cómo saber que este escalón está completo

- `p95` de latencia < 100ms en procedures principales con carga simulada
- Todos los listados tienen paginación
- HydrationBoundary en todos los Server Components que prefetchean datos
- ISR configurado en ecommerce-front para catálogo público

---

## Escalón 12 — Alta Disponibilidad y Chaos Engineering

### Qué hay que hacer

1. **Múltiples réplicas** — configurar 2+ réplicas de sass-back y ecommerce-back
   en Railway. El `MemoryCacheAdapter` no funciona entre réplicas — confirmar
   que Redis es el caché principal antes de escalar.

2. **Health check con 3 estados**:
   - `status: "ok"` — todo funciona
   - `status: "degraded"` — funciona pero con dependencias lentas (ej: Firebase tarda)
   - `status: "down"` — no puede servir requests

3. **Comportamiento de ecommerce-back si sass-back cae** — hoy:
   `OrganizationsClientService` rechaza con 503 si sass-back no responde (timeout 2s).
   ¿Es correcto para el checkout? ¿Para ver el catálogo público? Documentar.

4. **Chaos drill básico**:
   - Apagar sass-back → ¿cómo responde ecommerce-back?
   - Cortar Redis → ¿el `MemoryCacheAdapter` toma el relevo correctamente?
   - Saturar la queue de webhooks → ¿los deliveries fallan silenciosamente?

5. **Documentar resultados del chaos** — qué se rompió, qué funcionó,
   qué se arregló. El chaos drill sin documentación es solo un ejercicio.

### Cómo saber que este escalón está completo

- 2+ réplicas de sass-back y ecommerce-back en Railway
- Health check con 3 estados implementado en los 2 backs
- Chaos drill documentado con resultados
- Comportamientos de degradación documentados en `architecture/00-principios.md`

---

## Escalón 13 — Eficiencia Financiera (FinOps)

### Qué hay que hacer

1. **Costo por servicio** — Railway expone métricas de consumo por servicio.
   Medir cuánto cuesta cada servicio mensualmente y documentarlo.

2. **Costo marginal por organización nueva** — poder responder:
   "si agregamos 100 organizaciones nuevas, ¿cuánto sube la factura?"

3. **Escalado automático en Railway** — configurar:
   - Escalar hacia arriba cuando CPU > 70% sostenido 2 minutos
   - Escalar hacia abajo cuando CPU < 20% sostenido 5 minutos

4. **TTL de caché como palanca de costo** — documentar la decisión de TTL
   por tipo de dato: caché largo = menos queries = menos costo.
   Caché corto = datos más frescos = más costo. No hay respuesta única.

5. **ISR vs SSR en ecommerce-front** — cada visita SSR cuesta cómputo.
   Maximizar ISR para reducir costo de render por visita.

### Cómo saber que este escalón está completo

- Dashboard de costos por servicio configurado
- Escalado automático configurado en Railway
- Costo marginal documentado antes de cada campaña de adquisición
EOF
echo "✓ lifecycle/04-fase-escala.md"

# =============================================================================
# 05-tasks.md — 63 tasks ejecutables
# =============================================================================
cat > "$LIFECYCLE_DIR/05-tasks.md" << 'EOF'
# Tasks — Cómo escalar a cada fase

Checklist ejecutable para welver/. Cada task tiene ID, qué hacer y criterio de "done".
En orden de ejecución dentro de cada fase.

---

## FASE 1 — Desarrollo (Escalones 1, 2, 4)

### Escalón 1 — Código

- [ ] **[E1-01]** Eliminar `CatalogController` (REST) de ecommerce-back
  → Ya existe `adminCatalog.*` router tRPC
  → Done cuando: el archivo no existe y `pnpm build` pasa

- [ ] **[E1-02]** Eliminar `InventoryController` (REST) de ecommerce-back
  → Ya existe `adminInventory.*` router tRPC

- [ ] **[E1-03]** Eliminar `OrdersController` + `CheckoutController` (REST) de ecommerce-back
  → Ya existe `adminOrders.*` router tRPC

- [ ] **[E1-04]** Eliminar `CartController` (REST) de ecommerce-back
  → Ya existe `customer.*` router tRPC

- [ ] **[E1-05]** Migrar `CustomersController.identify` → procedure `customer.identify`
  → Done cuando: el procedure existe y el front lo usa

- [ ] **[E1-06]** Agregar `customer.resolveStore` procedure en ecommerce-back
  → Reemplaza `GET /store/by-slug/:slug` REST
  → Done cuando: ecommerce-front usa el procedure, no el endpoint REST

- [ ] **[E1-07]** Migrar `lib/store/client.ts` en ecommerce-front a tRPC server caller
  → Done cuando: el archivo no existe

- [ ] **[E1-08]** Migrar `lib/store/resolver.ts` en ecommerce-front a tRPC server caller
  → Done cuando: el archivo no existe

- [ ] **[E1-09]** Migrar `context/customer-context.tsx` — `identifyCustomer()` → `trpc.customer.identify`
  → Done cuando: sin llamadas fetch manuales en el archivo

- [ ] **[E1-10]** Eliminar DTOs class-validator huérfanos de ecommerce-back (post-E1-01 a E1-04)
  → Done cuando: `grep -r "class-validator" realsass-ecommerce-back/src` → 0 resultados

- [ ] **[E1-11]** Eliminar DTOs class-validator huérfanos de sass-back
  → `auth/dto/sync.dto.ts`, `organizations/dto/update-organization.dto.ts`, etc.
  → Done cuando: `grep -r "class-validator" realsass-sass-back/src` → 0 resultados

- [ ] **[E1-12]** Migrar `cart/` de ecommerce-back a Domain + Repository
  → Molde: `catalog/` del mismo servicio
  → Done cuando: `cart.service.ts` no importa `PrismaService`

- [ ] **[E1-13]** Migrar `orders/` de ecommerce-back a Domain + Repository
- [ ] **[E1-14]** Migrar `customers/` de ecommerce-back a Domain + Repository
- [ ] **[E1-15]** Migrar `inventory/` de ecommerce-back a Domain + Repository

- [ ] **[E1-16]** Verificar scope `organizationId` en todos los queries Prisma
  → Comando: `grep -rn "findMany\|findFirst" realsass-ecommerce-back/src --include="*.ts" | grep -v "organizationId"`
  → Done cuando: 0 queries de negocio sin scope de tenant

### Escalón 2 — Configuración

- [ ] **[E2-01]** Verificar ausencia de secretos en el repo
  → `git grep -r "PRIVATE_KEY\|-----BEGIN" --include="*.ts"` → 0 resultados con valores reales

- [ ] **[E2-02]** Crear `.env.example` en cada servicio (5 servicios)
  → Incluir: `DATABASE_URL`, `REDIS_URL`, `FIREBASE_*`, `SASS_BACK_URL`, `ALLOWED_ORIGINS`

- [ ] **[E2-03]** Agregar validación de env vars al arranque en `main.ts` de cada back
  → Done cuando: el back falla con mensaje claro si falta una var obligatoria

### Escalón 4 — Base de Datos

- [ ] **[E4-01]** Auditar índices en schemas de Prisma — `@@index([organizationId])` en modelos de alta frecuencia
  → Schemas: `realsass-sass-back/prisma/schema.prisma` y `realsass-ecommerce-back/prisma/schema.prisma`

- [ ] **[E4-02]** Confirmar `prisma migrate deploy` antes del `CMD` en los 2 Dockerfiles de backs

- [ ] **[E4-03]** Documentar política de backups Railway y RPO en `roadmap/deuda-tecnica.md`

- [ ] **[E4-04]** Documentar límites de pool de conexiones por back en `services/*.md`

---

## FASE 2 — Estabilización (Escalones 3, 5, 6)

### Escalón 3 — Infraestructura

- [ ] **[E3-01]** Agregar `helmet` en `main.ts` de sass-back y ecommerce-back
- [ ] **[E3-02]** Agregar `@nestjs/throttler` — rate limiting general por IP
- [ ] **[E3-03]** Rate limiting estricto en `POST /auth/session` (10 req/min por IP)
- [ ] **[E3-04]** Rate limiting en endpoint de identificación de clientes ecommerce
- [ ] **[E3-05]** Confirmar que solo el puerto 3000 es público en cada servicio Railway

### Escalón 5 — CI/CD

- [ ] **[E5-01]** Crear `.github/workflows/realsass-sass-back.yml` — typecheck + build
- [ ] **[E5-02]** Crear `.github/workflows/realsass-ecommerce-back.yml`
- [ ] **[E5-03]** Crear `.github/workflows/realsass-sass-front.yml`
- [ ] **[E5-04]** Crear `.github/workflows/realsass-dashboard-front.yml`
- [ ] **[E5-05]** Crear `.github/workflows/real-ecommerce-front.yml`
- [ ] **[E5-06]** Crear `.github/workflows/packages.yml` — typecheck de auth-server y trpc
- [ ] **[E5-07]** Agregar workflow que corre typecheck de los 3 fronts cuando cambia un router tRPC
- [ ] **[E5-08]** Configurar branch protection en GitHub main — CI obligatorio
- [ ] **[E5-09]** Documentar procedimiento de rollback en `conventions/deploy.md`

### Escalón 6 — Observabilidad

- [ ] **[E6-01]** Estandarizar logging JSON: `service`, `organizationId`, `correlationId`, `level`, `message`, `timestamp`
- [ ] **[E6-02]** Implementar propagación de `correlationId` en headers HTTP entre backs
- [ ] **[E6-03]** Activar configuración de Prometheus/OpenTelemetry que está en catalog
- [ ] **[E6-04]** Métricas estándar: `http_requests_total`, `trpc_requests_total`, `prisma_query_duration_seconds`
- [ ] **[E6-05]** Mejorar health check: agregar verificación de Redis
- [ ] **[E6-06]** Configurar alerta en Railway cuando `/health` falla

---

## FASE 3 — Hardening (Escalones 7, 8, 10)

### Escalón 7 — Seguridad

- [ ] **[E7-01]** Agregar `pnpm audit` en todos los workflows — fallar si hay CVE crítico
- [ ] **[E7-02]** Configurar Dependabot en GitHub para alertas de vulnerabilidades
- [ ] **[E7-03]** Auditar usos de `$queryRaw` en Prisma — verificar sin interpolación
- [ ] **[E7-04]** Agregar logs de seguridad con campo `securityEvent: true`
- [ ] **[E7-05]** Escribir runbook de respuesta a incidente de seguridad

### Escalón 8 — Privacidad

- [ ] **[E8-01]** Definir y documentar política de retención de datos por tipo
- [ ] **[E8-02]** Documentar proceso de eliminación de datos a pedido
- [ ] **[E8-03]** Verificar soft-delete en todos los modelos con datos de usuario
- [ ] **[E8-04]** Confirmar cifrado en reposo de Railway PostgreSQL y documentarlo
- [ ] **[E8-05]** Test de cross-tenant: request de org A no retorna datos de org B

### Escalón 10 — Async

- [ ] **[E10-01]** Auditar claves de Redis — todas deben incluir `organizationId` como prefijo
- [ ] **[E10-02]** Instalar Bull Board para monitoreo de webhook delivery queue
- [ ] **[E10-03]** Documentar plan de queue para órdenes cuando pagos-back exista
- [ ] **[E10-04]** Confirmar Redis con persistencia AOF activa
- [ ] **[E10-05]** Documentar TTL de caché por tipo de dato en `services/realsass-sass-back.md`

---

## FASE 4 — Escala (Escalones 9, 11, 12, 13)

### Escalón 9 — Disaster Recovery

- [ ] **[E9-01]** Definir RTO y RPO por servicio — documentar en este archivo
- [ ] **[E9-02]** Probar restauración de backup de DB en staging — documentar resultado
- [ ] **[E9-03]** Escribir runbook para los 3 escenarios más probables de falla
- [ ] **[E9-04]** Ejecutar drill de recuperación (apagar sass-back) y documentar RTO real

### Escalón 11 — Rendimiento

- [ ] **[E11-01]** Medir latencias actuales: `p50`, `p95`, `p99` por procedure tRPC
- [ ] **[E11-02]** Agregar `<HydrationBoundary>` en todos los Server Components con prefetch
- [ ] **[E11-03]** Agregar paginación a todos los procedures de listado sin límite
- [ ] **[E11-04]** Auditar queries lentas con `EXPLAIN ANALYZE` en ambas DBs
- [ ] **[E11-05]** Configurar ISR en ecommerce-front para páginas de catálogo público

### Escalón 12 — Alta Disponibilidad

- [ ] **[E12-01]** Configurar 2+ réplicas de sass-back y ecommerce-back en Railway
- [ ] **[E12-02]** Confirmar que Redis (no MemoryCache) es el caché principal antes de escalar réplicas
- [ ] **[E12-03]** Implementar health check con 3 estados: ok / degraded / down
- [ ] **[E12-04]** Chaos drill: apagar sass-back y documentar comportamiento de ecommerce-back
- [ ] **[E12-05]** Chaos drill: cortar Redis y documentar fallback a MemoryCacheAdapter
- [ ] **[E12-06]** Documentar comportamientos de degradación decididos en `architecture/00-principios.md`

### Escalón 13 — FinOps

- [ ] **[E13-01]** Configurar dashboard de costos por servicio en Railway
- [ ] **[E13-02]** Calcular y documentar costo mensual por servicio
- [ ] **[E13-03]** Configurar escalado automático en Railway para sass-back y ecommerce-back
- [ ] **[E13-04]** Documentar costo marginal de agregar N organizaciones nuevas
- [ ] **[E13-05]** Documentar decisión de TTL de caché como balance costo/frescura

---

## Resumen de progreso

| Fase | Tasks totales | Completadas | % |
|------|--------------|-------------|---|
| Fase 1 — Desarrollo | 19 | 0 | 0% |
| Fase 2 — Estabilización | 18 | 0 | 0% |
| Fase 3 — Hardening | 15 | 0 | 0% |
| Fase 4 — Escala | 17 | 0 | 0% |
| **Total** | **69** | **0** | **0%** |

Actualizar este resumen en cada sprint.
Marcar `- [x]` cuando el criterio de "done" está cumplido, no antes.
EOF
echo "✓ lifecycle/05-tasks.md"

# =============================================================================
# Resumen final
# =============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ .claude/lifecycle/ inicializado exitosamente para welver/"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Archivos creados:"
find "$LIFECYCLE_DIR" -type f | sort | sed "s|$ROOT_DIR/||"
echo ""
echo "Total: $(find "$LIFECYCLE_DIR" -type f | wc -l) archivos · 69 tasks en 4 fases"
echo ""
echo "Diferencias clave vs ecosistema-ms:"
echo "  - Estado Escalón 1 es 🟡 Avanzado (no ❌) — sass-back tiene Domain/Repo completo"
echo "  - Tasks E1-01 a E1-10 son específicas de eliminar controllers REST + migrar ecommerce-front"
echo "  - Escalón 2 está en 9.5/10 (catalog único, CORS, cookies HttpOnly ya resueltos)"
echo "  - Escalón 10 refleja BullMQ de webhooks (no campañas) + Redis cache existente"
echo ""
echo "Próximos pasos:"
echo "  1. git add .claude/lifecycle/ && git commit -m 'chore: agregar lifecycle al .claude/ welver'"
echo "  2. Arrancar con [E1-01] — eliminar CatalogController REST de ecommerce-back"
echo ""