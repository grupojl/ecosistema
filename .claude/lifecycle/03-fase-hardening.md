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
