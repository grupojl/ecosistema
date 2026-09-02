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
