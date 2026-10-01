# Auditoría Redis keys con organizationId — 2026-09-30

## Resultado: ✅ TODAS LAS KEYS DE NEGOCIO TIENEN SCOPE DE ORG

### Keys auditadas

| Key pattern | Archivo | ¿Tiene orgId? | Nota |
|---|---|---|---|
| `config:${orgId}:${tipo}:${k}` | sass-back/config-cache/config-cache.service.ts | ✅ | orgId en posición 2 |
| `org-access:${uid}:${orgId}` | ecommerce-back/organizations-client/organizations-client.service.ts | ✅ | orgId en posición 3 |
| `market:${organizationId}:${code}` | ecommerce-back/organizations-client/organizations-client.service.ts | ✅ | orgId en posición 2 |
| `market:${organizationId}:${code}` | ecommerce-back/markets/market-resolver.service.ts | ✅ | orgId en posición 2 |
| `health:ping` | sass-back/health/health.controller.ts | N/A | ✅ Healthcheck — no es dato de negocio |

### Convención de naming confirmada

```
<dominio>:<organizationId>:<identificador>
```

Ejemplo: `config:org_abc123:themes:active`

### No hay keys sin scope de organización para datos de negocio

La única key sin orgId es `health:ping` — correcto, es un ping de infraestructura,
no un dato de negocio que deba estar aislado por tenant.

## Comando para re-auditar

```bash
grep -rn "redis\.set\|redis\.get\|redis\.setex\|this\.redis\." \
  realsass-sass-back/src \
  realsass-ecommerce-back/src \
  --include="*.ts" \
  | grep -v '\.spec\.' \
  | grep -v 'health:ping'
```

**Fecha:** 2026-09-30
