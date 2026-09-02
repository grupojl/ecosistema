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
