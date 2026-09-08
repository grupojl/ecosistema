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
